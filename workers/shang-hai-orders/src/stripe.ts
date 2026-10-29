import type { PricedLine } from "../../../src/lib/commerce/types";
import { STRIPE_API_VERSION } from "./config";
import { hmacSha256Hex, timingSafeEqual } from "./crypto";

const STRIPE_API = "https://api.stripe.com/v1";

/** Checkout sessions expire after 60 minutes (Stripe allows 30 min – 24 h). */
export const SESSION_TTL_SECONDS = 60 * 60;

export type CheckoutSessionInput = {
  orderId: string;
  storefront: string;
  catalogVersion: string;
  customerEmail: string;
  lines: PricedLine[];
  deliveryFeeCents: number;
  successUrl: string;
  cancelUrl: string;
  now: Date;
  fulfillment: "pickup" | "delivery";
};

/** Builds the form-encoded Checkout Session request. Every amount comes from the server quote. */
export function buildCheckoutSessionForm(input: CheckoutSessionInput): URLSearchParams {
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("locale", "es");
  form.set("client_reference_id", input.orderId);
  form.set("customer_email", input.customerEmail);
  form.set("success_url", input.successUrl);
  form.set("cancel_url", input.cancelUrl);
  form.set("expires_at", String(Math.floor(input.now.getTime() / 1000) + SESSION_TTL_SECONDS));
  form.set("submit_type", "pay");

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
    form.set(`line_items[${i}][price_data][product_data][name]`, "Gastos de envío");
  }

  const metadata = {
    order_id: input.orderId,
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
    `Pedido ${input.orderId} · SHANG HAI (${input.fulfillment === "pickup" ? "recogida" : "reparto"})`,
  );
  return form;
}

export type CreatedSession = { id: string; url: string };

export async function createCheckoutSession(
  fetchImpl: typeof fetch,
  secretKey: string,
  form: URLSearchParams,
  idempotencyKey: string,
): Promise<{ ok: true; session: CreatedSession } | { ok: false; status: number }> {
  let res: Response;
  try {
    res = await fetchImpl(`${STRIPE_API}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": STRIPE_API_VERSION,
        "Idempotency-Key": idempotencyKey,
      },
      body: form.toString(),
    });
  } catch {
    return { ok: false, status: 0 };
  }
  if (!res.ok) return { ok: false, status: res.status };
  const body = (await res.json().catch(() => null)) as { id?: unknown; url?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const url = typeof body?.url === "string" ? body.url : "";
  // Only ever hand the customer a genuine Stripe-hosted Checkout URL.
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id) || !url.startsWith("https://checkout.stripe.com/")) {
    return { ok: false, status: 502 };
  }
  return { ok: true, session: { id, url } };
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
