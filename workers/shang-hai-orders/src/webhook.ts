import { resolvePayments } from "./config";
import {
  attachStripeSession,
  claimStripeEvent,
  finishStripeEvent,
  getOrder,
  getOrderByPaymentIntent,
  setState,
  updateOrderIf,
  type OrderRow,
} from "./db";
import type { Deps, Env } from "./env";
import { errorJson, json, readBodyLimited } from "./http";
import { log } from "./log";
import { verifyStripeSignature } from "./stripe";
import { syncOrderPayment } from "./sync";

/** Stripe events are small; 256 KB leaves plenty of headroom. */
const MAX_WEBHOOK_BYTES = 256 * 1024;

type StripeObject = {
  object?: string;
  id?: string;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
  payment_intent?: string | { id?: string } | null;
};

type StripeEvent = {
  id?: string;
  type?: string;
  livemode?: boolean;
  data?: { object?: StripeObject };
};

/**
 * Events this endpoint listens to (configure the same list in the Stripe Dashboard).
 * Whatever the event, the order is re-synced from the PaymentIntent fetched from Stripe,
 * so the payload's content (beyond ids) is never trusted and arrival order does not matter.
 */
export const HANDLED_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "payment_intent.amount_capturable_updated",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
  "payment_intent.processing",
  "charge.refunded",
  "charge.expired",
  "refund.created",
  "refund.updated",
  "refund.failed",
] as const;

const HANDLED = new Set<string>(HANDLED_EVENTS);

function idOf(value: string | { id?: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id ?? null;
}

/**
 * POST /api/stripe/webhook
 * Only verified Stripe events change payment status. Each event id is processed once.
 * The customer returning to the success URL never changes anything by itself.
 */
export async function handleStripeWebhook(request: Request, env: Env, deps: Deps): Promise<Response> {
  const secret = env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) return errorJson("webhook-not-configured", 503);

  const body = await readBodyLimited(request, MAX_WEBHOOK_BYTES);
  if (!body.ok) return errorJson("payload-too-large", 413);
  const nowSeconds = Math.floor(deps.now().getTime() / 1000);
  const check = await verifyStripeSignature(body.text, request.headers.get("Stripe-Signature"), secret, nowSeconds);
  if (!check.ok) {
    log("webhook.rejected", { reason: check.reason });
    return errorJson("invalid-signature", 400);
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(body.text) as StripeEvent;
  } catch {
    return errorJson("invalid-payload", 400);
  }
  // Any JSON parses (null, a number, an array…): only an object with an id and a type is an event.
  if (!event || typeof event !== "object" || typeof event.id !== "string" || typeof event.type !== "string") {
    return errorJson("invalid-payload", 400);
  }
  const now = deps.now().toISOString();
  await setState(env.DB, "stripe.last_webhook", event.type, now);
  if (!HANDLED.has(event.type)) return json({ received: true, handled: false });

  const claim = await claimStripeEvent(env.DB, { id: event.id, type: event.type, livemode: Boolean(event.livemode) }, now);
  if (claim === "duplicate") return json({ received: true, duplicate: true });

  try {
    const result = await processEvent(env, deps, event as StripeEvent & { id: string; type: string }, now);
    if (result.retry) {
      await finishStripeEvent(env.DB, event.id, "failed", result.orderId, now);
      log("webhook.retry-later", { eventId: event.id, type: event.type, orderId: result.orderId });
      return errorJson("stripe-unavailable", 500);
    }
    await finishStripeEvent(env.DB, event.id, result.status, result.orderId, now);
    log("webhook.processed", { eventId: event.id, type: event.type, outcome: result.outcome, orderId: result.orderId });
    return json({ received: true });
  } catch (error) {
    await finishStripeEvent(env.DB, event.id, "failed", null, now).catch(() => undefined);
    log("webhook.failed", { eventId: event.id, message: error instanceof Error ? error.message : "unknown" });
    // 500 makes Stripe retry later; the event row allows a clean retry.
    return errorJson("server", 500);
  }
}

type ProcessResult = { status: "processed" | "ignored"; orderId: string | null; outcome: string; retry?: boolean };

async function findOrder(env: Env, object: StripeObject, kind: "session" | "intent" | "child"): Promise<OrderRow | null> {
  const byMeta = object.metadata?.order_id ?? (kind === "session" ? object.client_reference_id ?? null : null);
  if (byMeta) {
    const order = await getOrder(env.DB, byMeta);
    if (order) return order;
  }
  if (kind === "session" && object.id) {
    return env.DB.prepare(`SELECT * FROM orders WHERE stripe_session_id = ?`).bind(object.id).first<OrderRow>();
  }
  const pi = kind === "intent" ? object.id ?? null : idOf(object.payment_intent);
  return pi ? getOrderByPaymentIntent(env.DB, pi) : null;
}

async function processEvent(env: Env, deps: Deps, event: StripeEvent & { id: string; type: string }, now: string): Promise<ProcessResult> {
  const object = event.data?.object;
  if (!object || typeof object.id !== "string") return { status: "ignored", orderId: null, outcome: "no-object" };
  const kind = object.object === "checkout.session" ? "session" : object.object === "payment_intent" ? "intent" : "child";
  const order = await findOrder(env, object, kind);
  if (!order) return { status: "ignored", orderId: null, outcome: "unknown-order" };

  // An event whose mode (test/live) differs from this deployment is never applied.
  const deploymentLive = resolvePayments(env).mode === "stripe-live";
  if (Boolean(event.livemode) !== deploymentLive || Boolean(event.livemode) !== (order.payments_mode === "stripe-live")) {
    return { status: "ignored", orderId: order.id, outcome: "mode-mismatch" };
  }

  const meta = { source: "stripe" as const, stripeEventId: event.id };
  let paymentIntentId: string | null = kind === "intent" ? object.id : idOf(object.payment_intent);

  if (kind === "session") {
    // The session must be the one we created for this order.
    if (order.stripe_session_id && order.stripe_session_id !== object.id) {
      await updateOrderIf(env.DB, order.id, order.status, order.status === "needs_review" ? null : "needs_review", { review_reason: "La sesión de Stripe no coincide con el pedido" }, {
        ...meta,
        note: "La sesión de Stripe no coincide con el pedido",
        now,
      });
      return { status: "processed", orderId: order.id, outcome: "session-mismatch" };
    }
    if (!order.stripe_session_id) await attachStripeSession(env.DB, order.id, object.id, now);
    if (event.type === "checkout.session.expired" && !paymentIntentId) {
      if (order.status === "pending" || order.status === "failed") {
        await updateOrderIf(env.DB, order.id, order.status, "cancelled", {}, {
          ...meta,
          note: "La sesión de pago caducó sin completarse; no se ha cobrado nada",
          now,
        });
        return { status: "processed", orderId: order.id, outcome: "cancelled" };
      }
      return { status: "processed", orderId: order.id, outcome: "expired-ignored" };
    }
  }
  if (!paymentIntentId) paymentIntentId = order.stripe_payment_intent_id;
  if (!paymentIntentId) return { status: "processed", orderId: order.id, outcome: "no-payment-intent" };

  const synced = await syncOrderPayment(env, deps, order.id, meta, { paymentIntentId });
  if (!synced.ok) {
    // Stripe unreachable, or payments switched off for a moment (key rotation): answer 5xx so
    // Stripe delivers the event again later — never store it as handled and lose it.
    if (synced.reason === "stripe-unavailable" || synced.reason === "payments-disabled") {
      return { status: "processed", orderId: order.id, outcome: "retry", retry: true };
    }
    return { status: "ignored", orderId: order.id, outcome: synced.reason };
  }

  // A session that expired after a failed payment attempt ends the order (nothing charged).
  if (event.type === "checkout.session.expired" && (synced.order.status === "pending" || synced.order.status === "failed")) {
    await updateOrderIf(env.DB, order.id, synced.order.status, "cancelled", {}, {
      ...meta,
      note: "La sesión de pago caducó sin completarse; no se ha cobrado nada",
      now,
    });
    return { status: "processed", orderId: order.id, outcome: "cancelled" };
  }
  return { status: "processed", orderId: order.id, outcome: synced.changed ? `synced:${synced.order.status}` : "unchanged" };
}

/** Exposed for /api/config and /api/health. */
export function paymentsModeFor(env: Env) {
  return resolvePayments(env).mode;
}
