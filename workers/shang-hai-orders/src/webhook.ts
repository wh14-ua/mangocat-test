import type { OrderStatus } from "../../../src/lib/commerce/types";
import { resolvePayments } from "./config";
import {
  claimStripeEvent,
  finishStripeEvent,
  getOrder,
  recordNote,
  transitionOrder,
  updateStripeFields,
  type OrderRow,
} from "./db";
import type { Deps, Env } from "./env";
import { errorJson, json, readBodyLimited } from "./http";
import { log } from "./log";
import { verifyStripeSignature } from "./stripe";

/** Stripe events are small; 256 KB leaves plenty of headroom. */
const MAX_WEBHOOK_BYTES = 256 * 1024;

type CheckoutSessionObject = {
  object?: string;
  id?: string;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
  payment_status?: "paid" | "unpaid" | "no_payment_required";
  amount_total?: number | null;
  currency?: string | null;
  livemode?: boolean;
  payment_intent?: string | { id?: string } | null;
};

type StripeEvent = {
  id?: string;
  type?: string;
  livemode?: boolean;
  data?: { object?: CheckoutSessionObject };
};

const HANDLED = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

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
  if (typeof event.id !== "string" || typeof event.type !== "string") {
    return errorJson("invalid-payload", 400);
  }
  if (!HANDLED.has(event.type)) return json({ received: true, handled: false });

  const now = deps.now().toISOString();
  const claim = await claimStripeEvent(
    env.DB,
    { id: event.id, type: event.type, livemode: Boolean(event.livemode) },
    now,
  );
  if (claim === "duplicate") return json({ received: true, duplicate: true });

  try {
    const result = await processSessionEvent(env, event as Required<Pick<StripeEvent, "id" | "type">> & StripeEvent, now);
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

type ProcessResult = { status: "processed" | "ignored"; orderId: string | null; outcome: string };

async function processSessionEvent(
  env: Env,
  event: StripeEvent & { id: string; type: string },
  now: string,
): Promise<ProcessResult> {
  const session = event.data?.object;
  if (!session || session.object !== "checkout.session" || typeof session.id !== "string") {
    return { status: "ignored", orderId: null, outcome: "not-a-session" };
  }
  const orderId = session.client_reference_id ?? session.metadata?.order_id ?? null;
  const order = orderId ? await getOrder(env.DB, orderId) : null;
  if (!order) return { status: "ignored", orderId: null, outcome: "unknown-order" };

  const meta = { source: "stripe" as const, stripeEventId: event.id, now };
  const paymentIntent =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;

  // The session must be the one we created for this order.
  if (order.stripe_session_id && order.stripe_session_id !== session.id) {
    await moveTo(env, order, "needs_review", { ...meta, note: "La sesión de Stripe no coincide con el pedido" });
    return { status: "processed", orderId: order.id, outcome: "session-mismatch" };
  }

  await updateStripeFields(
    env.DB,
    order.id,
    {
      stripe_session_id: order.stripe_session_id ?? session.id,
      stripe_payment_intent_id: paymentIntent ?? undefined,
      stripe_payment_status: session.payment_status ?? undefined,
      stripe_amount_total: typeof session.amount_total === "number" ? session.amount_total : undefined,
      stripe_livemode: typeof session.livemode === "boolean" ? (session.livemode ? 1 : 0) : undefined,
    },
    now,
  );

  if (event.type === "checkout.session.expired") {
    if (order.status === "pending" || order.status === "failed") {
      await moveTo(env, order, "cancelled", { ...meta, note: "La sesión de pago caducó sin completarse" });
      return { status: "processed", orderId: order.id, outcome: "cancelled" };
    }
    return { status: "processed", orderId: order.id, outcome: "expired-ignored" };
  }

  if (event.type === "checkout.session.async_payment_failed") {
    await moveTo(env, order, "failed", { ...meta, note: "El pago asíncrono ha fallado" });
    return { status: "processed", orderId: order.id, outcome: "failed" };
  }

  // completed / async_payment_succeeded: reconcile before marking anything as paid.
  const mismatch = reconcile(order, session, event);
  if (mismatch) {
    await moveTo(env, order, "needs_review", { ...meta, note: mismatch });
    return { status: "processed", orderId: order.id, outcome: "needs-review" };
  }

  if (event.type === "checkout.session.async_payment_succeeded" || session.payment_status === "paid") {
    await moveTo(env, order, "paid", { ...meta, note: "Pago confirmado por Stripe" });
    return { status: "processed", orderId: order.id, outcome: "paid" };
  }

  // completed with payment_status "unpaid": a delayed payment method is still processing.
  await recordNote(env.DB, order.id, order.status, {
    ...meta,
    note: "Checkout completado; pago asíncrono en curso",
  });
  return { status: "processed", orderId: order.id, outcome: "awaiting-async-payment" };
}

function reconcile(order: OrderRow, session: CheckoutSessionObject, event: StripeEvent): string | null {
  if (session.amount_total !== order.total_cents) {
    return `Importe cobrado (${String(session.amount_total)}) distinto del total del pedido (${order.total_cents})`;
  }
  if ((session.currency ?? "").toLowerCase() !== "eur") return "Moneda distinta de EUR";
  const expectedLive = order.payments_mode === "stripe-live";
  if (Boolean(session.livemode ?? event.livemode) !== expectedLive) {
    return "El modo (pruebas/real) del pago no coincide con el del pedido";
  }
  return null;
}

async function moveTo(
  env: Env,
  order: OrderRow,
  to: OrderStatus,
  meta: { source: "stripe"; stripeEventId: string; now: string; note: string },
) {
  const result = await transitionOrder(env.DB, order.id, to, meta);
  if (!result.ok && result.reason !== "not-found") {
    // Not an allowed transition (e.g. a late event for a completed order): keep a trace.
    await recordNote(env.DB, order.id, result.from ?? order.status, {
      ...meta,
      note: `${meta.note} (sin cambio de estado: ${result.reason})`,
    });
  }
}

/** Exposed for /api/config and /api/health. */
export function paymentsModeFor(env: Env) {
  return resolvePayments(env).mode;
}
