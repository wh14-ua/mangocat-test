import type { PricedLine } from "../../../src/lib/commerce/types";
import type { CaptureMode } from "./config";
import { STRIPE_API_VERSION } from "./config";
import { hmacSha256Hex, timingSafeEqual } from "./crypto";

/** Checkout sessions expire after 60 minutes (Stripe allows 30 min – 24 h). */
export const SESSION_TTL_SECONDS = 60 * 60;

/**
 * Payment methods that support authorise-now-capture-later in Checkout
 * (docs.stripe.com/payments/payment-methods/payment-method-support, "Manual capture").
 * Used by STRIPE_CAPTURE_MODE=per-method; Apple Pay and Google Pay are cards.
 */
export const MANUAL_CAPTURE_METHODS = ["card", "link", "paypal", "revolut_pay", "amazon_pay", "klarna"] as const;

export type StripeClient = { fetch: typeof fetch; secretKey: string; apiBase: string; timeoutMs?: number };

export type StripeError = { type?: string; code?: string; message?: string; decline_code?: string };

export type StripeResult<T> =
  | { ok: true; status: number; body: T }
  | { ok: false; status: number; error: StripeError | null; network: boolean; timeout?: boolean };

/** No Stripe call may hold a request (or the cron) indefinitely. */
export const DEFAULT_STRIPE_TIMEOUT_MS = 15_000;

/**
 * How certain a failed call's outcome is:
 * - "unknown": no answer (network, timeout) or an answer that does not tell (409, 429, 5xx). The
 *   operation may or may not have happened at Stripe: re-read before deciding, never assume.
 * - "missing": 404 — Stripe does not know that object (deleted test data, another account or
 *   mode, a local stand-in that lost its state). Nothing can have happened to it from here.
 * - "refused": any other 4xx — Stripe answered and did not do it.
 */
export type FailureKind = "unknown" | "missing" | "refused";

export function failureKind(result: { status: number; network: boolean }): FailureKind {
  // 409: the same idempotency key is still being processed, or the object is locked by another
  // request — the operation may well complete: unknown, never "refused".
  if (result.network || result.status === 0 || result.status === 409 || result.status === 429 || result.status >= 500) return "unknown";
  if (result.status === 404) return "missing";
  return "refused";
}

/** "404 resource_missing", "timeout", "500 api_error"… for logs and review notes. */
export function describeFailure(result: { status: number; network: boolean; timeout?: boolean; error: StripeError | null }): string {
  if (result.timeout) return "sin respuesta (tiempo agotado)";
  if (result.status === 0) return "sin conexión";
  return [String(result.status), result.error?.code].filter(Boolean).join(" ");
}

/** One form-encoded call to the Stripe API with the pinned version (and an idempotency key on POST). */
export async function stripeRequest<T>(
  client: StripeClient,
  method: "GET" | "POST",
  path: string,
  options: { form?: URLSearchParams; idempotencyKey?: string; query?: URLSearchParams } = {},
): Promise<StripeResult<T>> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${client.secretKey}`,
    "Stripe-Version": STRIPE_API_VERSION,
  };
  if (method === "POST") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  }
  const query = options.query?.toString();
  const signal = AbortSignal.timeout(client.timeoutMs ?? DEFAULT_STRIPE_TIMEOUT_MS);
  let res: Response;
  let body: (T & { error?: StripeError }) | null;
  try {
    res = await client.fetch(`${client.apiBase}${path}${query ? `?${query}` : ""}`, {
      method,
      headers,
      signal,
      ...(method === "POST" ? { body: (options.form ?? new URLSearchParams()).toString() } : {}),
    });
    body = (await res.json().catch(() => null)) as (T & { error?: StripeError }) | null;
  } catch {
    return { ok: false, status: 0, error: null, network: true, timeout: signal.aborted };
  }
  if (!res.ok || !body) {
    return { ok: false, status: res.status, error: body?.error ?? null, network: res.status >= 500 || res.status === 429 };
  }
  return { ok: true, status: res.status, body };
}

// ---------------------------------------------------------------------------
// Checkout Session
// ---------------------------------------------------------------------------

export type CheckoutSessionInput = {
  orderId: string;
  orderNumber: number;
  storefront: string;
  catalogVersion: string;
  customerEmail: string;
  /** Line names already in the customer's language. */
  lines: PricedLine[];
  deliveryFeeCents: number;
  successUrl: string;
  cancelUrl: string;
  now: Date;
  fulfillment: "pickup" | "delivery";
  locale: "es" | "en";
  captureMode: CaptureMode;
};

/** Stripe Checkout locales (docs.stripe.com/api/checkout/sessions/create#locale). */
const STRIPE_LOCALE: Record<"es" | "en", string> = { es: "es", en: "en-GB" };

/**
 * Builds the form-encoded Checkout Session request. Every amount comes from the server
 * quote. Payment methods are NOT listed (the pinned API version rejects
 * `payment_method_types`): Stripe offers what is enabled in the Dashboard — cards, Apple
 * Pay, Google Pay and Link when the customer is eligible — and, with manual capture,
 * automatically hides methods that cannot place a hold.
 */
export function buildCheckoutSessionForm(input: CheckoutSessionInput): URLSearchParams {
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("locale", STRIPE_LOCALE[input.locale]);
  form.set("client_reference_id", input.orderId);
  form.set("customer_email", input.customerEmail);
  form.set("success_url", input.successUrl);
  form.set("cancel_url", input.cancelUrl);
  form.set("expires_at", String(Math.floor(input.now.getTime() / 1000) + SESSION_TTL_SECONDS));
  form.set("submit_type", "pay");

  if (input.captureMode === "manual") {
    // Authorise only. The restaurant's acceptance captures; a rejection releases the hold.
    form.set("payment_intent_data[capture_method]", "manual");
  } else {
    // Methods that can hold funds are authorised; any other method is charged at once and
    // refunded if the restaurant rejects the order.
    for (const method of MANUAL_CAPTURE_METHODS) {
      form.set(`payment_method_options[${method}][capture_method]`, "manual");
    }
  }

  const english = input.locale === "en";
  input.lines.forEach((line, i) => {
    form.set(`line_items[${i}][quantity]`, String(line.quantity));
    form.set(`line_items[${i}][price_data][currency]`, "eur");
    form.set(`line_items[${i}][price_data][unit_amount]`, String(line.unitPriceCents));
    form.set(`line_items[${i}][price_data][product_data][name]`, line.name.slice(0, 250));
    if (line.optionsLabel) {
      form.set(`line_items[${i}][price_data][product_data][description]`, line.optionsLabel.slice(0, 250));
    }
  });
  if (input.deliveryFeeCents > 0) {
    const i = input.lines.length;
    form.set(`line_items[${i}][quantity]`, "1");
    form.set(`line_items[${i}][price_data][currency]`, "eur");
    form.set(`line_items[${i}][price_data][unit_amount]`, String(input.deliveryFeeCents));
    form.set(`line_items[${i}][price_data][product_data][name]`, english ? "Delivery" : "Gastos de envío");
  }

  const metadata = {
    order_id: input.orderId,
    order_number: String(input.orderNumber),
    storefront: input.storefront,
    catalog_version: input.catalogVersion,
    fulfillment: input.fulfillment,
  };
  for (const [k, v] of Object.entries(metadata)) {
    form.set(`metadata[${k}]`, v);
    form.set(`payment_intent_data[metadata][${k}]`, v);
  }
  form.set(
    "payment_intent_data[description]",
    `Pedido #${input.orderNumber} (${input.orderId}) · SHANG HAI · ${input.fulfillment === "pickup" ? "recogida" : "reparto"}`,
  );
  return form;
}

export type CreatedSession = { id: string; url: string };

export async function createCheckoutSession(
  client: StripeClient,
  form: URLSearchParams,
  idempotencyKey: string,
  isAllowedUrl: (url: string) => boolean,
): Promise<{ ok: true; session: CreatedSession } | { ok: false; status: number }> {
  const res = await stripeRequest<{ id?: unknown; url?: unknown }>(client, "POST", "/checkout/sessions", {
    form,
    idempotencyKey,
  });
  if (!res.ok) return { ok: false, status: res.status };
  const id = typeof res.body.id === "string" ? res.body.id : "";
  const url = typeof res.body.url === "string" ? res.body.url : "";
  // Only ever hand the customer a genuine Stripe-hosted Checkout URL.
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id) || !isAllowedUrl(url)) return { ok: false, status: 502 };
  return { ok: true, session: { id, url } };
}

// ---------------------------------------------------------------------------
// PaymentIntents and refunds
// ---------------------------------------------------------------------------

export type StripeCharge = {
  id?: string;
  amount_refunded?: number;
  refunded?: boolean;
  captured?: boolean;
  payment_method_details?: { type?: string; card?: { capture_before?: number | null } | null } | null;
};

export type StripePaymentIntent = {
  id: string;
  object?: string;
  status:
    | "requires_payment_method"
    | "requires_confirmation"
    | "requires_action"
    | "processing"
    | "requires_capture"
    | "succeeded"
    | "canceled";
  amount: number;
  amount_capturable?: number;
  amount_received?: number;
  currency: string;
  livemode?: boolean;
  metadata?: Record<string, string> | null;
  cancellation_reason?: string | null;
  last_payment_error?: { code?: string; message?: string } | null;
  latest_charge?: string | StripeCharge | null;
};

export type StripeRefund = {
  id: string;
  object?: string;
  status: "pending" | "requires_action" | "succeeded" | "failed" | "canceled";
  amount: number;
  payment_intent?: string | null;
  failure_reason?: string | null;
  metadata?: Record<string, string> | null;
};

export function retrievePaymentIntent(client: StripeClient, id: string) {
  return stripeRequest<StripePaymentIntent>(client, "GET", `/payment_intents/${encodeURIComponent(id)}`, {
    query: new URLSearchParams([["expand[]", "latest_charge"]]),
  });
}

export function capturePaymentIntent(client: StripeClient, id: string, idempotencyKey: string) {
  return stripeRequest<StripePaymentIntent>(client, "POST", `/payment_intents/${encodeURIComponent(id)}/capture`, {
    idempotencyKey,
    form: new URLSearchParams([["expand[]", "latest_charge"]]),
  });
}

/** Releases an authorisation (only possible while it is `requires_capture`). No refund is created. */
export function cancelPaymentIntent(client: StripeClient, id: string, idempotencyKey: string) {
  return stripeRequest<StripePaymentIntent>(client, "POST", `/payment_intents/${encodeURIComponent(id)}/cancel`, {
    idempotencyKey,
    form: new URLSearchParams([["expand[]", "latest_charge"]]),
  });
}

/** Refunds the payment (everything still refundable, or `amount` cents when given). */
export function createRefund(
  client: StripeClient,
  paymentIntentId: string,
  idempotencyKey: string,
  metadata: Record<string, string>,
  amount?: number,
) {
  const form = new URLSearchParams();
  form.set("payment_intent", paymentIntentId);
  if (amount !== undefined) form.set("amount", String(amount));
  form.set("reason", "requested_by_customer");
  for (const [k, v] of Object.entries(metadata)) form.set(`metadata[${k}]`, v);
  return stripeRequest<StripeRefund>(client, "POST", "/refunds", { form, idempotencyKey });
}

export function retrieveRefund(client: StripeClient, id: string) {
  return stripeRequest<StripeRefund>(client, "GET", `/refunds/${encodeURIComponent(id)}`);
}

/** Every refund of a PaymentIntent (newest first): the truth when an earlier answer was lost. */
export function listRefunds(client: StripeClient, paymentIntentId: string) {
  return stripeRequest<{ data: StripeRefund[] }>(client, "GET", "/refunds", {
    query: new URLSearchParams([
      ["payment_intent", paymentIntentId],
      ["limit", "20"],
    ]),
  });
}

export function retrieveCheckoutSession(client: StripeClient, id: string) {
  return stripeRequest<{ id: string; status?: string; payment_intent?: string | { id?: string } | null; client_reference_id?: string | null }>(
    client,
    "GET",
    `/checkout/sessions/${encodeURIComponent(id)}`,
  );
}

// ---------------------------------------------------------------------------
// Webhook signatures (docs.stripe.com/webhooks#verify-manually)
// ---------------------------------------------------------------------------

export const SIGNATURE_TOLERANCE_SECONDS = 300;

export type SignatureCheck =
  | { ok: true; timestamp: number }
  | { ok: false; reason: "missing-header" | "malformed-header" | "timestamp-out-of-tolerance" | "no-matching-signature" };

/**
 * Verifies the Stripe-Signature header: HMAC-SHA256 of `${t}.${rawBody}` with the
 * endpoint secret, compared in constant time against every v1 signature (several are
 * present while a secret is being rolled). Other schemes (v0) are ignored.
 */
export async function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds: number,
  toleranceSeconds = SIGNATURE_TOLERANCE_SECONDS,
): Promise<SignatureCheck> {
  if (!header) return { ok: false, reason: "missing-header" };
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, ...rest] = part.trim().split("=");
    const value = rest.join("=");
    if (key === "t" && /^\d+$/.test(value)) timestamp = Number(value);
    else if (key === "v1" && /^[0-9a-f]{64}$/i.test(value)) signatures.push(value.toLowerCase());
  }
  if (timestamp === null || signatures.length === 0) return { ok: false, reason: "malformed-header" };
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    return { ok: false, reason: "timestamp-out-of-tolerance" };
  }
  const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  let match = false;
  for (const sig of signatures) match = timingSafeEqual(expected, sig) || match;
  return match ? { ok: true, timestamp } : { ok: false, reason: "no-matching-signature" };
}
