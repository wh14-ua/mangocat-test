import type { PaymentStatus } from "../../../src/lib/commerce/types";
import { resolvePayments, stripeApiBase, stripeTimeoutMs } from "./config";
import { getOrder, updateOrderIf, type EventSource, type OrderPatch, type OrderRow } from "./db";
import type { Deps, Env } from "./env";
import { log } from "./log";
import { notifySoon } from "./notifications";
import { factsFromIntent, planFromPayment, type PaymentFacts } from "./payments";
import {
  failureKind,
  listRefunds,
  retrieveCheckoutSession,
  retrievePaymentIntent,
  type StripeClient,
  type StripePaymentIntent,
  type StripeRefund,
} from "./stripe";

export function stripeClient(env: Env, deps: Deps): StripeClient | null {
  const payments = resolvePayments(env);
  if (payments.mode === "disabled") return null;
  return { fetch: deps.fetch, secretKey: payments.secretKey, apiBase: stripeApiBase(env), timeoutMs: stripeTimeoutMs(env) };
}

export type SyncOutcome =
  | { ok: true; order: OrderRow; changed: boolean; facts: PaymentFacts | null; missing?: string }
  | { ok: false; reason: "payments-disabled" | "not-found" | "stripe-unavailable" };

/** Review note for a payment Stripe does not know (the 404 of the 2026-11-06 demo). */
export function missingPaymentNote(paymentIntentId: string, consequence: string): string {
  return (
    `Stripe no encuentra el pago ${paymentIntentId}: ${consequence}. ` +
    "Comprueba en el Dashboard de Stripe que la clave y el modo (prueba/real) son los de este pedido; " +
    "en la demo local, el Stripe simulado perdió sus datos (arranca con --fresh)"
  );
}

/** Orders that claim money is held, charged or being returned: a vanished payment needs a human. */
function claimsMoney(order: OrderRow): boolean {
  if (["awaiting_acceptance", "preparing", "ready"].includes(order.status)) return true;
  return order.status === "rejected" && (order.payment_status === "refund_pending" || order.payment_status === "refund_failed");
}

const REFUND_STATES = new Set(["refund_pending", "refunded", "refund_failed"]);

type Meta = { source: EventSource; actor?: string | null; stripeEventId?: string | null };

/** The PaymentIntent id of an order (from the order, or from its Checkout Session). */
async function paymentIntentIdFor(client: StripeClient, order: OrderRow): Promise<string | null | "error"> {
  if (order.stripe_payment_intent_id) return order.stripe_payment_intent_id;
  if (!order.stripe_session_id) return null;
  const session = await retrieveCheckoutSession(client, order.stripe_session_id);
  if (!session.ok) return session.status === 404 ? null : "error";
  const pi = session.body.payment_intent;
  return typeof pi === "string" ? pi : pi?.id ?? null;
}

/** Fresh PaymentIntent (+ our refund, if any) from Stripe. */
export async function fetchPaymentFacts(
  client: StripeClient,
  order: OrderRow,
  paymentIntentId?: string | null,
): Promise<{ ok: true; facts: PaymentFacts | null; pi: StripePaymentIntent | null; missing?: string } | { ok: false }> {
  const piId = paymentIntentId ?? (await paymentIntentIdFor(client, order));
  if (piId === "error") return { ok: false };
  if (!piId) return { ok: true, facts: null, pi: null };
  const pi = await retrievePaymentIntent(client, piId);
  if (!pi.ok) return failureKind(pi) === "missing" ? { ok: true, facts: null, pi: null, missing: piId } : { ok: false };
  // Refunds are read from Stripe's list (ours, ones whose answer was lost, Dashboard ones)
  // whenever money may have gone back; never inferred from the charge alone.
  let refunds: StripeRefund[] = [];
  const charge = typeof pi.body.latest_charge === "object" ? pi.body.latest_charge : null;
  if (pi.body.status === "succeeded" && (order.stripe_refund_id || (charge?.amount_refunded ?? 0) > 0 || REFUND_STATES.has(order.payment_status))) {
    const list = await listRefunds(client, piId);
    if (!list.ok) return { ok: false };
    refunds = list.body.data ?? [];
  }
  return { ok: true, facts: factsFromIntent(pi.body, refunds), pi: pi.body };
}

/** Stripe columns that mirror the facts (payment status itself comes from the plan). */
export function stripePatch(order: OrderRow, facts: PaymentFacts, payment: PaymentStatus, now: string): OrderPatch {
  const placed = payment === "authorized" || payment === "captured";
  return {
    payment_status: payment,
    stripe_payment_intent_id: facts.paymentIntentId,
    stripe_payment_status: facts.piStatus,
    stripe_amount_total: facts.amount,
    stripe_livemode: facts.livemode ? 1 : 0,
    ...(facts.captureBefore ? { stripe_capture_before: facts.captureBefore } : {}),
    ...(facts.refund ? { stripe_refund_id: facts.refund.id, stripe_refund_status: facts.refund.status } : {}),
    ...(placed && !order.authorized_at ? { authorized_at: now } : {}),
    ...(payment === "captured" && !order.paid_at ? { paid_at: now } : {}),
  };
}

/**
 * Brings an order in line with Stripe. Called for every relevant webhook (whatever its
 * type or order of arrival), by the cron for stragglers, and by the staff "retry" button.
 * Returns "stripe-unavailable" when Stripe could not be read: webhooks answer 500 so that
 * Stripe retries, and nothing is changed.
 */
export async function syncOrderPayment(
  env: Env,
  deps: Deps,
  orderId: string,
  meta: Meta,
  options: { paymentIntentId?: string | null } = {},
): Promise<SyncOutcome> {
  const client = stripeClient(env, deps);
  if (!client) return { ok: false, reason: "payments-disabled" };

  for (let attempt = 0; attempt < 3; attempt++) {
    const order = await getOrder(env.DB, orderId);
    if (!order) return { ok: false, reason: "not-found" };
    const fetched = await fetchPaymentFacts(client, order, options.paymentIntentId);
    if (!fetched.ok) return { ok: false, reason: "stripe-unavailable" };
    const now = deps.now().toISOString();
    if (fetched.missing) {
      // The order says money is held or charged, and Stripe does not know the payment.
      if (!claimsMoney(order)) return { ok: true, order, changed: false, facts: null, missing: fetched.missing };
      const note = missingPaymentNote(fetched.missing, "el pedido no puede seguir sin confirmar el dinero");
      const res = await updateOrderIf(env.DB, order.id, order.status, "needs_review", { review_reason: note }, { ...meta, note, now });
      if (!res.ok) continue;
      notifySoon(env, deps, order.id, "needs_review");
      log("payment.missing", { orderId: order.id, from: order.status });
      return { ok: true, order: (await getOrder(env.DB, order.id)) ?? order, changed: true, facts: null, missing: fetched.missing };
    }
    if (!fetched.facts) return { ok: true, order, changed: false, facts: null };

    const plan = planFromPayment(order, fetched.facts);
    const patch: OrderPatch = {
      ...stripePatch(order, fetched.facts, plan.paymentStatus, now),
      ...(plan.reviewReason ? { review_reason: plan.reviewReason } : {}),
    };
    const meaningful = plan.to !== null || plan.paymentStatus !== order.payment_status;
    const res = await updateOrderIf(env.DB, order.id, order.status, plan.to, patch, meaningful ? { ...meta, note: plan.note, now } : null, now);
    if (!res.ok) continue; // the order moved meanwhile: read it again and re-plan

    if (plan.notifyNewOrder) notifySoon(env, deps, order.id, "new_order");
    if (plan.to === "needs_review") notifySoon(env, deps, order.id, "needs_review");
    if (meaningful) {
      log("payment.synced", { orderId: order.id, from: order.status, to: plan.to ?? order.status, payment: plan.paymentStatus });
    }
    const updated = await getOrder(env.DB, order.id);
    return { ok: true, order: updated ?? order, changed: meaningful, facts: fetched.facts };
  }
  return { ok: false, reason: "stripe-unavailable" };
}
