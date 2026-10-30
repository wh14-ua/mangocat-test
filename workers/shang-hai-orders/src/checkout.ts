import { prepareOrder } from "../../../src/lib/commerce/checkout/prepare-order";
import { shangHaiCatalog, shangHaiOrdering } from "../../../src/lib/shang-hai/catalog";
import { STOREFRONT_IDS } from "../../../src/lib/shang-hai/storefronts";
import { buildReturnUrls, resolvePayments } from "./config";
import { newOrderId, newOrderToken, sha256Hex } from "./crypto";
import { attachStripeSession, insertOrder, transitionOrder, type NewOrder } from "./db";
import type { Deps, Env } from "./env";
import { clientIp, errorJson, isAllowedOrigin, isJsonRequest, json, readBodyLimited, requestOrigin } from "./http";
import { allow } from "./rate-limit";
import { buildCheckoutSessionForm, createCheckoutSession } from "./stripe";
import { log } from "./log";

/**
 * POST /api/checkout
 * The browser sends item ids and quantities. Everything that costs money is recomputed
 * here from the shared catalog (prepareOrder), stored as a pending order, and only then
 * sent to Stripe Checkout. The order becomes "paid" exclusively via a verified webhook.
 */
export async function handleCheckout(request: Request, env: Env, deps: Deps): Promise<Response> {
  const origin = requestOrigin(request);
  if (origin !== null && !isAllowedOrigin(env, origin)) return errorJson("forbidden-origin", 403);
  if (!(await allow(env.CHECKOUT_LIMITER, `checkout:${clientIp(request)}`))) {
    return json({ error: "rate-limited" }, 429, { "Retry-After": "60" });
  }
  if (!isJsonRequest(request)) return errorJson("unsupported-media-type", 415);
  const body = await readBodyLimited(request);
  if (!body.ok) return errorJson("payload-too-large", 413);

  let payload: unknown;
  try {
    payload = JSON.parse(body.text);
  } catch {
    return json({ error: "invalid", fieldErrors: { body: "Petición no válida." } }, 400);
  }

  const payments = resolvePayments(env);
  if (payments.mode === "disabled") {
    log("checkout.disabled", { reason: payments.reason });
    return errorJson("payments-disabled", 503);
  }

  const now = deps.now();
  const prepared = prepareOrder(payload, {
    index: shangHaiCatalog,
    ordering: shangHaiOrdering,
    allowedStorefronts: STOREFRONT_IDS,
    now,
  });
  if (!prepared.ok) {
    switch (prepared.error) {
      case "invalid":
        return json({ error: "invalid", fieldErrors: prepared.fieldErrors }, 422);
      case "not-payable":
        return json({ error: "not-payable", issues: prepared.issues }, 422);
      case "price-changed":
        return json({ error: "price-changed", totalCents: prepared.totalCents }, 409);
      case "age-confirmation-required":
        return errorJson("age-confirmation-required", 422);
      case "payments-disabled":
        return errorJson("payments-disabled", 503);
      default:
        return errorJson("server", 500);
    }
  }
  const { request: order, quote } = prepared.value;

  const orderId = newOrderId(now);
  const token = newOrderToken();
  const urls = buildReturnUrls(env, { storefront: order.storefront, orderId, token });
  if (!urls) {
    log("checkout.config-error", { reason: "invalid-return-url" });
    return errorJson("server", 500);
  }

  const timestamp = now.toISOString();
  const row: NewOrder = {
    id: orderId,
    token_hash: await sha256Hex(token),
    status: "pending",
    storefront: order.storefront,
    fulfillment: order.fulfillment,
    catalog_id: shangHaiCatalog.catalog.catalogId,
    catalog_version: shangHaiCatalog.catalog.version,
    currency: "EUR",
    subtotal_cents: quote.subtotalCents,
    delivery_fee_cents: quote.deliveryFeeCents,
    total_cents: quote.totalCents,
    customer_name: order.customer.name,
    customer_phone: order.customer.phone,
    customer_email: order.customer.email,
    customer_notes: order.customer.notes ?? null,
    delivery_street: order.delivery?.street ?? null,
    delivery_postal_code: order.delivery?.postalCode ?? null,
    delivery_city: order.delivery?.city ?? null,
    delivery_notes: order.delivery?.notes ?? null,
    age_confirmed: order.ageConfirmed ? 1 : 0,
    payments_mode: payments.mode,
    created_at: timestamp,
    updated_at: timestamp,
  };

  try {
    await insertOrder(env.DB, row, quote.lines);
  } catch (error) {
    log("checkout.store-failed", { message: error instanceof Error ? error.message : "unknown" });
    return errorJson("server", 500);
  }

  const form = buildCheckoutSessionForm({
    orderId,
    storefront: order.storefront,
    catalogVersion: shangHaiCatalog.catalog.version,
    customerEmail: order.customer.email,
    lines: quote.lines,
    deliveryFeeCents: quote.deliveryFeeCents,
    successUrl: urls.successUrl,
    cancelUrl: urls.cancelUrl,
    now,
    fulfillment: order.fulfillment,
  });
  const created = await createCheckoutSession(deps.fetch, payments.secretKey, form, `checkout-${orderId}`);
  if (!created.ok) {
    log("checkout.stripe-failed", { orderId, status: created.status });
    await transitionOrder(env.DB, orderId, "cancelled", {
      source: "system",
      note: "No se pudo crear la sesión de pago en Stripe",
      now: deps.now().toISOString(),
    }).catch(() => undefined);
    return errorJson("server", 502);
  }

  try {
    await attachStripeSession(env.DB, orderId, created.session.id, deps.now().toISOString());
  } catch (error) {
    // Not fatal: the webhook matches the session through client_reference_id and stores it.
    log("checkout.attach-failed", { orderId, message: error instanceof Error ? error.message : "unknown" });
  }
  log("checkout.created", {
    orderId,
    storefront: order.storefront,
    totalCents: quote.totalCents,
    lines: quote.lines.length,
    mode: payments.mode,
  });
  return json(
    { orderId, orderToken: token, checkoutUrl: created.session.url, mode: payments.mode },
    201,
  );
}
