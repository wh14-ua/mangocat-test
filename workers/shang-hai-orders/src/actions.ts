import type { OrderStatus } from "../../../src/lib/commerce/types";
import { cleanText } from "../../../src/lib/commerce/validation";
import { PREP_MINUTES_MAX, PREP_MINUTES_MIN } from "./config";
import { getOrder, updateOrderIf, type EventSource, type OrderPatch, type OrderRow } from "./db";
import type { Deps, Env } from "./env";
import { log } from "./log";
import { notifySoon } from "./notifications";
import { factsFromIntent } from "./payments";
import {
  cancelPaymentIntent,
  capturePaymentIntent,
  createRefund,
  retrievePaymentIntent,
  retrieveRefund,
  type StripeClient,
  type StripeRefund,
} from "./stripe";
import { stripeClient, stripePatch, syncOrderPayment } from "./sync";

/**
 * What staff can do from the panel. Each action:
 * 1. checks the order's current state and payment;
 * 2. takes a short lock with a conditional UPDATE (awaiting_acceptance -> accepting /
 *    rejecting): if two phones tap at the same time, exactly one wins and the other gets
 *    "ya gestionado";
 * 3. talks to Stripe with an idempotency key (a retried request never charges twice);
 * 4. finishes with another conditional UPDATE, writing who did what in order_events.
 * If the outcome at Stripe is unknown (timeout), the lock stays and the cron resolves it
 * from Stripe's real state a minute later; the kitchen never sees an unpaid order.
 */

export type Actor = { label: string; source: EventSource };

export type ActionResult =
  | { ok: true; order: OrderRow; message: string; pending?: boolean }
  | { ok: false; status: number; error: string; message: string; order?: OrderRow | null };

const STATUS_NAME: Record<OrderStatus, string> = {
  pending: "pendiente de pago",
  awaiting_acceptance: "pendiente de aceptación",
  accepting: "aceptándose",
  rejecting: "rechazándose",
  preparing: "en preparación",
  ready: "listo para recoger",
  completed: "entregado",
  rejected: "rechazado",
  failed: "pago no completado",
  cancelled: "cancelado",
  needs_review: "en revisión",
};

function fail(status: number, error: string, message: string, order?: OrderRow | null): ActionResult {
  return { ok: false, status, error, message, order };
}

/** Explains why an action no longer applies (another phone got there first, etc.). */
function alreadyHandled(order: OrderRow): ActionResult {
  switch (order.status) {
    case "accepting":
      return fail(409, "in-progress", "Otro dispositivo está aceptando este pedido ahora mismo.", order);
    case "rejecting":
      return fail(409, "in-progress", "Otro dispositivo está rechazando este pedido ahora mismo.", order);
    case "preparing":
    case "ready":
    case "completed":
      return fail(409, "already-accepted", "Este pedido ya estaba aceptado.", order);
    case "rejected":
      return fail(409, "already-rejected", "Este pedido ya se había rechazado.", order);
    case "cancelled":
      return fail(409, "cancelled", "Este pedido está cancelado: no se ha cobrado nada.", order);
    default:
      return fail(409, "transition-not-allowed", `Ahora no se puede hacer eso: el pedido está ${STATUS_NAME[order.status]}.`, order);
  }
}

async function reload(env: Env, id: string, fallback: OrderRow): Promise<OrderRow> {
  return (await getOrder(env.DB, id)) ?? fallback;
}

// ---------------------------------------------------------------------------
// Accept
// ---------------------------------------------------------------------------

export function validPrepMinutes(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= PREP_MINUTES_MIN && value <= PREP_MINUTES_MAX;
}

async function finishAccept(env: Env, deps: Deps, order: OrderRow, actor: Actor, patch: OrderPatch): Promise<ActionResult> {
  const now = deps.now();
  const minutes = order.prep_minutes ?? 20;
  const res = await updateOrderIf(
    env.DB,
    order.id,
    "accepting",
    "preparing",
    {
      ...patch,
      payment_status: "captured",
      accepted_at: now.toISOString(),
      ready_by: new Date(now.getTime() + minutes * 60_000).toISOString(),
      review_reason: null,
      ...(order.paid_at ? {} : { paid_at: now.toISOString() }),
    },
    { source: actor.source, actor: actor.label, note: `Pago cobrado. En preparación (${minutes} min)`, now: now.toISOString() },
  );
  const updated = await reload(env, order.id, order);
  if (!res.ok) return alreadyHandled(updated);
  log("order.accepted", { orderId: order.id, minutes });
  return { ok: true, order: updated, message: `Pedido aceptado: listo en unos ${minutes} min.` };
}

export async function acceptOrder(env: Env, deps: Deps, id: string, prepMinutes: unknown, actor: Actor): Promise<ActionResult> {
  if (!validPrepMinutes(prepMinutes)) {
    return fail(422, "invalid-prep-minutes", `Indica un tiempo entre ${PREP_MINUTES_MIN} y ${PREP_MINUTES_MAX} minutos.`);
  }
  const order = await getOrder(env.DB, id);
  if (!order) return fail(404, "not-found", "No existe ese pedido.");
  if (order.status !== "awaiting_acceptance" && order.status !== "needs_review") return alreadyHandled(order);
  if (order.payment_status !== "authorized" && order.payment_status !== "captured") {
    return fail(409, "payment-not-ready", "El pago de este pedido no está confirmado. No lo prepares.", order);
  }
  const client = stripeClient(env, deps);
  if (order.payment_status === "authorized" && !client) {
    return fail(503, "payments-disabled", "No se puede cobrar ahora: los pagos no están configurados.", order);
  }

  const now = deps.now().toISOString();
  const lock = await updateOrderIf(env.DB, id, order.status, "accepting", { prep_minutes: prepMinutes }, {
    source: actor.source,
    actor: actor.label,
    note: `Aceptado (${prepMinutes} min); cobrando el pago`,
    now,
  });
  if (!lock.ok) return alreadyHandled(await reload(env, id, order));
  const locked: OrderRow = { ...order, status: "accepting", prep_minutes: prepMinutes };

  // Paid by a method without a prior hold: nothing to capture.
  if (order.payment_status === "captured") return finishAccept(env, deps, locked, actor, {});
  return captureAndFinish(env, deps, locked, actor, client);
}

async function captureAndFinish(env: Env, deps: Deps, order: OrderRow, actor: Actor, client: StripeClient | null = null): Promise<ActionResult> {
  const stripe = client ?? stripeClient(env, deps);
  const piId = order.stripe_payment_intent_id;
  if (!stripe || !piId) return toReview(env, deps, order, "accepting", actor, "No hay un pago de Stripe asociado a este pedido");

  const capture = await capturePaymentIntent(stripe, piId, `capture-${order.id}`);
  if (capture.ok && capture.body.status === "succeeded") {
    return finishAccept(env, deps, order, actor, stripePatch(order, factsFromIntent(capture.body), "captured", deps.now().toISOString()));
  }

  // The capture failed or its outcome is unknown: decide from Stripe's real state.
  const fresh = await retrievePaymentIntent(stripe, piId);
  if (!fresh.ok) {
    log("order.accept-unknown", { orderId: order.id, status: capture.ok ? capture.status : capture.status });
    return {
      ok: true,
      pending: true,
      order: await reload(env, order.id, order),
      message:
        "Stripe no responde. Comprobaremos el cobro automáticamente en un minuto. No prepares el pedido hasta que aparezca en EN PREPARACIÓN.",
    };
  }
  const facts = factsFromIntent(fresh.body);
  const now = deps.now().toISOString();
  switch (fresh.body.status) {
    case "succeeded":
      return finishAccept(env, deps, order, actor, stripePatch(order, facts, "captured", now));
    case "requires_capture": {
      // Still capturable: nothing was charged; the decision can simply be retried.
      await updateOrderIf(env.DB, order.id, "accepting", "awaiting_acceptance", stripePatch(order, facts, "authorized", now), {
        source: "system",
        note: "No se pudo cobrar en este momento; el pedido vuelve a pendientes",
        now,
      });
      return fail(502, "capture-failed", "No se ha podido cobrar ahora mismo (Stripe). Vuelve a pulsar ACEPTAR en unos segundos.", await reload(env, order.id, order));
    }
    case "canceled": {
      await updateOrderIf(env.DB, order.id, "accepting", "cancelled", stripePatch(order, facts, "canceled", now), {
        source: "system",
        note: "La autorización del pago ya no era válida; no se ha cobrado nada",
        now,
      });
      return fail(
        409,
        "authorization-expired",
        "No se puede cobrar: la autorización del pago ha caducado o se ha anulado. NO prepares este pedido. No se ha cobrado nada al cliente.",
        await reload(env, order.id, order),
      );
    }
    default:
      return toReview(env, deps, order, "accepting", actor, `No se pudo cobrar: estado del pago en Stripe «${fresh.body.status}»`);
  }
}

// ---------------------------------------------------------------------------
// Reject (also used for "cancel after accepting" and for automatic timeouts)
// ---------------------------------------------------------------------------

const REJECTABLE: readonly OrderStatus[] = ["awaiting_acceptance", "needs_review", "preparing", "ready"];

export async function rejectOrder(env: Env, deps: Deps, id: string, rawReason: unknown, actor: Actor): Promise<ActionResult> {
  const reason = cleanText(rawReason, 200);
  const order = await getOrder(env.DB, id);
  if (!order) return fail(404, "not-found", "No existe ese pedido.");
  if (!REJECTABLE.includes(order.status)) return alreadyHandled(order);
  // refund_failed: the money is still with the restaurant, so the refund must be retried.
  const needsStripe = ["authorized", "captured", "refund_failed"].includes(order.payment_status);
  const client = stripeClient(env, deps);
  if (needsStripe && !client) {
    return fail(503, "payments-disabled", "No se puede anular el pago ahora: los pagos no están configurados.", order);
  }

  const now = deps.now().toISOString();
  const lock = await updateOrderIf(env.DB, id, order.status, "rejecting", { rejection_reason: reason || null }, {
    source: actor.source,
    actor: actor.label,
    note: reason ? `Rechazado: ${reason}` : "Rechazado",
    now,
  });
  if (!lock.ok) return alreadyHandled(await reload(env, id, order));
  return releaseAndFinish(env, deps, { ...order, status: "rejecting", rejection_reason: reason || null }, actor);
}

async function finishReject(env: Env, deps: Deps, order: OrderRow, actor: Actor, patch: OrderPatch, note: string): Promise<ActionResult> {
  const now = deps.now().toISOString();
  const res = await updateOrderIf(env.DB, order.id, "rejecting", "rejected", { ...patch, rejected_at: now, review_reason: null }, {
    source: actor.source,
    actor: actor.label,
    note,
    now,
  });
  const updated = await reload(env, order.id, order);
  if (!res.ok) return alreadyHandled(updated);
  log("order.rejected", { orderId: order.id, payment: updated.payment_status });
  return { ok: true, order: updated, message: note };
}

async function toReview(env: Env, deps: Deps, order: OrderRow, from: OrderStatus, actor: Actor, reason: string, patch: OrderPatch = {}): Promise<ActionResult> {
  const now = deps.now().toISOString();
  await updateOrderIf(env.DB, order.id, from, "needs_review", { ...patch, review_reason: reason }, {
    source: "system",
    actor: actor.label,
    note: reason,
    now,
  });
  notifySoon(env, deps, order.id, "needs_review");
  log("order.needs-review", { orderId: order.id, from });
  return fail(502, "needs-review", `${reason}. El pedido queda EN REVISIÓN.`, await reload(env, order.id, order));
}

function refundPatch(refund: StripeRefund): OrderPatch {
  return { stripe_refund_id: refund.id, stripe_refund_status: refund.status };
}

async function finishFromRefund(env: Env, deps: Deps, order: OrderRow, actor: Actor, r: StripeRefund): Promise<ActionResult> {
  switch (r.status) {
    case "succeeded":
      return finishReject(env, deps, order, actor, { ...refundPatch(r), payment_status: "refunded" }, "Pedido rechazado. Stripe ha confirmado el reembolso.");
    case "pending":
    case "requires_action":
      return finishReject(
        env,
        deps,
        order,
        actor,
        { ...refundPatch(r), payment_status: "refund_pending" },
        "Pedido rechazado. Reembolso solicitado; Stripe aún no lo ha confirmado.",
      );
    default:
      return toReview(env, deps, order, "rejecting", actor, `La devolución ha fallado en Stripe (${r.failure_reason ?? r.status})`, {
        ...refundPatch(r),
        payment_status: "refund_failed",
      });
  }
}

async function refundAndFinish(env: Env, deps: Deps, stripe: StripeClient, order: OrderRow, actor: Actor): Promise<ActionResult> {
  const piId = order.stripe_payment_intent_id as string;
  // A refund already requested for this order (still pending or done) is followed, not repeated.
  if (order.stripe_refund_id) {
    const existing = await retrieveRefund(stripe, order.stripe_refund_id);
    if (existing.ok && existing.body.status !== "failed" && existing.body.status !== "canceled") {
      return finishFromRefund(env, deps, order, actor, existing.body);
    }
  }
  const attempt = order.refund_attempts + 1;
  await updateOrderIf(env.DB, order.id, "rejecting", null, { refund_attempts: attempt }, null);
  const refund = await createRefund(stripe, piId, `refund-${order.id}-${attempt}`, {
    order_id: order.id,
    order_number: String(order.number ?? ""),
  });
  if (!refund.ok) {
    // Already fully refunded (e.g. a previous attempt succeeded but we lost the answer)?
    const fresh = await retrievePaymentIntent(stripe, piId);
    if (fresh.ok) {
      const facts = factsFromIntent(fresh.body);
      if (facts.amountReceived > 0 && facts.chargeRefunded >= facts.amountReceived) {
        return finishReject(env, deps, order, actor, { payment_status: "refunded" }, "Pedido rechazado. Pago ya reembolsado en Stripe.");
      }
    }
    return toReview(env, deps, order, "rejecting", actor, "No se pudo pedir la devolución a Stripe; pulsa RECHAZAR de nuevo para reintentarla", {
      payment_status: "captured",
    });
  }
  return finishFromRefund(env, deps, order, actor, refund.body);
}

async function releaseAndFinish(env: Env, deps: Deps, order: OrderRow, actor: Actor): Promise<ActionResult> {
  const stripe = stripeClient(env, deps);
  const piId = order.stripe_payment_intent_id;
  if (!["authorized", "captured", "refund_failed"].includes(order.payment_status)) {
    return finishReject(env, deps, order, actor, {}, "Pedido rechazado. No había ningún pago que anular.");
  }
  if (!stripe || !piId) return toReview(env, deps, order, "rejecting", actor, "No hay un pago de Stripe asociado a este pedido");
  if (order.payment_status !== "authorized") return refundAndFinish(env, deps, stripe, order, actor);

  const cancel = await cancelPaymentIntent(stripe, piId, `cancel-${order.id}`);
  if (cancel.ok && cancel.body.status === "canceled") {
    return finishReject(
      env,
      deps,
      order,
      actor,
      { ...stripePatch(order, factsFromIntent(cancel.body), "canceled", deps.now().toISOString()) },
      "Pedido rechazado. Autorización anulada: no se ha cobrado nada al cliente.",
    );
  }
  const fresh = await retrievePaymentIntent(stripe, piId);
  if (!fresh.ok) {
    return {
      ok: true,
      pending: true,
      order: await reload(env, order.id, order),
      message: "Stripe no responde. Anularemos el pago automáticamente en un minuto.",
    };
  }
  const facts = factsFromIntent(fresh.body);
  const now = deps.now().toISOString();
  if (fresh.body.status === "canceled") {
    return finishReject(env, deps, order, actor, stripePatch(order, facts, "canceled", now), "Pedido rechazado. Autorización anulada: no se ha cobrado nada al cliente.");
  }
  if (fresh.body.status === "succeeded") {
    // Captured meanwhile (e.g. from the Dashboard): refund instead.
    return refundAndFinish(env, deps, stripe, { ...order, payment_status: "captured" }, actor);
  }
  return toReview(env, deps, order, "rejecting", actor, "No se pudo anular la autorización del pago; pulsa RECHAZAR de nuevo", stripePatch(order, facts, "authorized", now));
}

// ---------------------------------------------------------------------------
// Kitchen states
// ---------------------------------------------------------------------------

export async function markReady(env: Env, deps: Deps, id: string, actor: Actor): Promise<ActionResult> {
  return simpleStep(env, deps, id, "preparing", "ready", { ready_at: deps.now().toISOString() }, actor, "Listo para recoger");
}

export async function markCompleted(env: Env, deps: Deps, id: string, actor: Actor): Promise<ActionResult> {
  return simpleStep(env, deps, id, "ready", "completed", { completed_at: deps.now().toISOString() }, actor, "Entregado al cliente");
}

async function simpleStep(
  env: Env,
  deps: Deps,
  id: string,
  from: OrderStatus,
  to: OrderStatus,
  patch: OrderPatch,
  actor: Actor,
  note: string,
): Promise<ActionResult> {
  const order = await getOrder(env.DB, id);
  if (!order) return fail(404, "not-found", "No existe ese pedido.");
  if (order.status === to) return fail(409, "already-done", `Este pedido ya estaba ${STATUS_NAME[to]}.`, order);
  if (order.status !== from) return alreadyHandled(order);
  const res = await updateOrderIf(env.DB, id, from, to, patch, { source: actor.source, actor: actor.label, note, now: deps.now().toISOString() });
  const updated = await reload(env, id, order);
  if (!res.ok) return alreadyHandled(updated);
  log("order.step", { orderId: id, to });
  return { ok: true, order: updated, message: note };
}

// ---------------------------------------------------------------------------
// Recovery: stale locks and the "retry" button
// ---------------------------------------------------------------------------

/** A lock older than this means the request that took it never finished. */
export const STALE_LOCK_MS = 90_000;

/**
 * Finishes (or undoes) an accept/reject whose request died half-way, from Stripe's real
 * state: a captured payment finishes the acceptance, a still-held one goes back to
 * pending; a rejection retries the release/refund with the same idempotency keys.
 */
export async function resolveLock(env: Env, deps: Deps, order: OrderRow, actor: Actor): Promise<ActionResult> {
  const stripe = stripeClient(env, deps);
  if (order.status === "rejecting") return releaseAndFinish(env, deps, order, actor);
  if (order.status !== "accepting") return { ok: true, order, message: "Sin cambios." };
  if (!stripe || !order.stripe_payment_intent_id) {
    if (order.payment_status === "captured") return finishAccept(env, deps, order, actor, {});
    return toReview(env, deps, order, "accepting", actor, "No hay un pago de Stripe asociado a este pedido");
  }
  const fresh = await retrievePaymentIntent(stripe, order.stripe_payment_intent_id);
  if (!fresh.ok) return { ok: true, pending: true, order, message: "Stripe sigue sin responder; se reintentará." };
  const now = deps.now().toISOString();
  const facts = factsFromIntent(fresh.body);
  if (fresh.body.status === "succeeded") return finishAccept(env, deps, order, actor, stripePatch(order, facts, "captured", now));
  if (fresh.body.status === "requires_capture") {
    await updateOrderIf(env.DB, order.id, "accepting", "awaiting_acceptance", stripePatch(order, facts, "authorized", now), {
      source: "system",
      note: "La aceptación no llegó a cobrarse; el pedido vuelve a pendientes",
      now,
    });
    return { ok: true, order: await reload(env, order.id, order), message: "El pedido vuelve a pendientes de aceptación." };
  }
  if (fresh.body.status === "canceled") {
    await updateOrderIf(env.DB, order.id, "accepting", "cancelled", stripePatch(order, facts, "canceled", now), {
      source: "system",
      note: "La autorización del pago ya no era válida; no se ha cobrado nada",
      now,
    });
    return { ok: true, order: await reload(env, order.id, order), message: "Autorización caducada: pedido cancelado sin cobro." };
  }
  return toReview(env, deps, order, "accepting", actor, `Estado del pago inesperado en Stripe («${fresh.body.status}»)`);
}

/** Staff "retry": re-read Stripe and finish whatever was left half-done. */
export async function retryOrder(env: Env, deps: Deps, id: string, actor: Actor): Promise<ActionResult> {
  const order = await getOrder(env.DB, id);
  if (!order) return fail(404, "not-found", "No existe ese pedido.");
  if (order.status === "accepting" || order.status === "rejecting") return resolveLock(env, deps, order, actor);
  const synced = await syncOrderPayment(env, deps, id, { source: actor.source, actor: actor.label });
  if (!synced.ok) {
    return fail(502, synced.reason, synced.reason === "payments-disabled" ? "Los pagos no están configurados." : "Stripe no responde. Inténtalo en un minuto.", order);
  }
  return { ok: true, order: synced.order, message: synced.changed ? "Estado actualizado desde Stripe." : "Todo está al día con Stripe." };
}
