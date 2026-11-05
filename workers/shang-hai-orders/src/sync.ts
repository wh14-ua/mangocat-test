import type { PaymentStatus } from "../../../src/lib/commerce/types";
import { resolvePayments, stripeApiBase } from "./config";
import { getOrder, updateOrderIf, type EventSource, type OrderPatch, type OrderRow } from "./db";
import type { Deps, Env } from "./env";
import { log } from "./log";
import { notifySoon } from "./notifications";
import { factsFromIntent, planFromPayment, type PaymentFacts } from "./payments";
import {
  retrieveCheckoutSession,
  retrievePaymentIntent,
  retrieveRefund,
  type StripeClient,
  type StripePaymentIntent,
  type StripeRefund,
} from "./stripe";

export function stripeClient(env: Env, deps: Deps): StripeClient | null {
  const payments = resolvePayments(env);
  if (payments.mode === "disabled") return null;
  return { fetch: deps.fetch, secretKey: payments.secretKey, apiBase: stripeApiBase(env) };
}

export type SyncOutcome =
  | { ok: true; order: OrderRow; changed: boolean; facts: PaymentFacts | null }
  | { ok: false; reason: "payments-disabled" | "not-found" | "stripe-unavailable" };

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
): Promise<{ ok: true; facts: PaymentFacts | null; pi: StripePaymentIntent | null } | { ok: false }> {
  const piId = paymentIntentId ?? (await paymentIntentIdFor(client, order));
  if (piId === "error") return { ok: false };
  if (!piId) return { ok: true, facts: null, pi: null };
  const pi = await retrievePaymentIntent(client, piId);
  if (!pi.ok) return pi.status === 404 ? { ok: true, facts: null, pi: null } : { ok: false };
  let refund: StripeRefund | null = null;
  if (order.stripe_refund_id) {
    const r = await retrieveRefund(client, order.stripe_refund_id);
    if (!r.ok) return { ok: false };
    refund = r.body;
  }
  return { ok: true, facts: factsFromIntent(pi.body, refund), pi: pi.body };
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
    ...(facts.refund ? { stripe_refund_status: facts.refund.status } : {}),
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
    if (!fetched.facts) return { ok: true, order, changed: false, facts: null };

    const now = deps.now().toISOString();
    const plan = planFromPayment(order, fetched.facts);
    const patch: OrderPatch = {
      ...stripePatch(order, fetched.facts, plan.paymentStatus, now),
      ...(plan.reviewReason ? { review_reason: plan.reviewReason } : {}),
    };
    const meaningful = plan.to !== null || plan.paymentStatus !== order.payment_status;
    const res = await updateOrderIf(env.DB, order.id, order.status, plan.to, patch, meaningful ? { ...meta, note: plan.note, now } : null);
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
