import type { OrderStatus } from "../../../src/lib/commerce/types";
import { cleanText } from "../../../src/lib/commerce/validation";
import { formatClock } from "../../../src/lib/i18n/format";
import { lockReviewMs, PREP_MINUTES_MAX, PREP_MINUTES_MIN } from "./config";
import { getOrder, lockInfo, updateOrderIf, type EventSource, type OrderPatch, type OrderRow } from "./db";
import type { Deps, Env } from "./env";
import { log } from "./log";
import { notifySoon } from "./notifications";
import { factsFromIntent, summarizeRefunds, type RefundSummary } from "./payments";
import {
  cancelPaymentIntent,
  capturePaymentIntent,
  createRefund,
  describeFailure,
  failureKind,
  listRefunds,
  retrievePaymentIntent,
  type StripeClient,
  type StripeResult,
} from "./stripe";
import { missingPaymentNote, stripeClient, stripePatch, syncOrderPayment } from "./sync";

/**
 * What staff can do from the panel. Each action:
 * 1. checks the order's current state and payment;
 * 2. takes a short lock with a conditional UPDATE (awaiting_acceptance -> accepting /
 *    rejecting): if two phones tap at the same time, exactly one wins and the other gets
 *    "ya gestionado";
 * 3. talks to Stripe with an idempotency key per attempt (Stripe replays a stored answer —
 *    even a 500 — for a reused key; a PaymentIntent can only be captured or cancelled once,
 *    and a refund can never exceed what was charged, so a new attempt cannot double anything);
 * 4. finishes with another conditional UPDATE, writing who did what in order_events.
 * If the outcome at Stripe is unknown (timeout, 5xx), the lock stays and the cron resolves it
 * from Stripe's real state; if Stripe still cannot tell after LOCK_REVIEW_SECONDS, or does
 * not know the payment at all (404), the order goes to EN REVISIÓN with what a person needs
 * to act, and the staff are alerted. The kitchen never sees an unpaid order, and no order
 * stays locked indefinitely.
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

  const { attempts } = await lockInfo(env.DB, order.id, "accepting");
  const capture = await capturePaymentIntent(stripe, piId, `capture-${order.id}-${Math.max(attempts, 1)}`);
  if (capture.ok && capture.body.status === "succeeded") {
    return finishAccept(env, deps, order, actor, stripePatch(order, factsFromIntent(capture.body), "captured", deps.now().toISOString()));
  }
  if (!capture.ok) log("order.capture-failed", { orderId: order.id, stripe: describeFailure(capture) });

  // The capture failed or its outcome is unknown: decide from Stripe's real state.
  const fresh = await retrievePaymentIntent(stripe, piId);
  if (!fresh.ok) return lockUnresolved(env, deps, order, actor, fresh, "accepting");
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
  const res = await updateOrderIf(env.DB, order.id, from, "needs_review", { ...patch, review_reason: reason }, {
    source: "system",
    actor: actor.label,
    note: reason,
    now,
  });
  const updated = await reload(env, order.id, order);
  if (!res.ok) return alreadyHandled(updated); // someone (or the cron) finished it meanwhile
  notifySoon(env, deps, order.id, "needs_review");
  log("order.needs-review", { orderId: order.id, from });
  return fail(502, "needs-review", `${reason}. El pedido queda EN REVISIÓN.`, updated);
}


/**
 * A Stripe call that could not tell what happened, while holding the accept/reject lock:
 * - 404: Stripe does not know the payment — nothing can be done to it from here: review now;
 * - other 4xx (bad key, permissions…): a configuration problem a person must fix: review now;
 * - no answer / 429 / 5xx: keep the lock (the cron re-reads Stripe every minute) until the
 *   deadline, then review with the facts: what was being done, since when, which payment.
 */
async function lockUnresolved(
  env: Env,
  deps: Deps,
  order: OrderRow,
  actor: Actor,
  failure: Extract<StripeResult<unknown>, { ok: false }>,
  from: "accepting" | "rejecting",
): Promise<ActionResult> {
  const piId = order.stripe_payment_intent_id ?? "(sin id)";
  const accepting = from === "accepting";
  const kind = failureKind(failure);
  log(accepting ? "order.accept-unresolved" : "order.reject-unresolved", { orderId: order.id, stripe: describeFailure(failure), kind });
  if (kind === "missing") {
    return toReview(env, deps, order, from, actor, missingPaymentNote(piId, accepting ? "no se ha cobrado nada" : "no se ha anulado ni devuelto nada"));
  }
  if (kind === "refused") {
    return toReview(env, deps, order, from, actor, `Stripe rechaza la consulta del pago ${piId} (${describeFailure(failure)}): revisa la configuración de Stripe`);
  }
  const since = (await lockInfo(env.DB, order.id, from)).since ?? order.updated_at;
  if (deps.now().getTime() - Date.parse(since) >= lockReviewMs(env)) {
    const at = formatClock(since, "es");
    return toReview(
      env,
      deps,
      order,
      from,
      actor,
      accepting
        ? `Stripe no responde desde las ${at}: no se sabe si se ha cobrado el pago ${piId}. No prepares el pedido hasta confirmarlo (Dashboard de Stripe o REINTENTAR)`
        : `Stripe no responde desde las ${at}: no se sabe si se ha anulado o devuelto el pago ${piId}. Compruébalo en el Dashboard de Stripe o pulsa REINTENTAR`,
    );
  }
  return {
    ok: true,
    pending: true,
    order: await reload(env, order.id, order),
    message: accepting
      ? "Stripe no responde. Comprobaremos el cobro automáticamente en un minuto. No prepares el pedido hasta que aparezca en EN PREPARACIÓN."
      : "Stripe no responde. Terminaremos la anulación automáticamente en un minuto.",
  };
}

function refundPatch(refund: RefundSummary): OrderPatch {
  return { stripe_refund_id: refund.id, stripe_refund_status: refund.status };
}

/** Finishes a rejection from what Stripe's refunds of the payment say (covering the full charge). */
async function finishFromRefund(env: Env, deps: Deps, order: OrderRow, actor: Actor, r: RefundSummary): Promise<ActionResult> {
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

/**
 * Returns the money of a charged payment. Stripe's list of refunds for the payment is the
 * truth (a refund whose answer was lost, or one made from the Dashboard, is followed instead
 * of repeated); only the part not yet covered is requested, with a new key per attempt.
 */
async function refundAndFinish(env: Env, deps: Deps, stripe: StripeClient, order: OrderRow, actor: Actor): Promise<ActionResult> {
  const piId = order.stripe_payment_intent_id as string;
  const pi = await retrievePaymentIntent(stripe, piId);
  if (!pi.ok) return lockUnresolved(env, deps, order, actor, pi, "rejecting");
  const received = pi.body.amount_received ?? 0;
  const before = await listRefunds(stripe, piId);
  if (!before.ok) return lockUnresolved(env, deps, order, actor, before, "rejecting");
  const existing = summarizeRefunds(before.body.data ?? [], received);
  if (existing && existing.status !== "failed" && existing.status !== "canceled" && !existing.partial) {
    return finishFromRefund(env, deps, order, actor, existing);
  }

  const attempt = order.refund_attempts + 1;
  const now = deps.now().toISOString();
  await updateOrderIf(env.DB, order.id, "rejecting", null, { refund_attempts: attempt }, null, now);
  const remaining = received - (existing && existing.status !== "failed" && existing.status !== "canceled" ? existing.amount : 0);
  const refund = await createRefund(stripe, piId, `refund-${order.id}-${attempt}`, {
    order_id: order.id,
    order_number: String(order.number ?? ""),
  }, existing?.partial ? remaining : undefined);
  if (refund.ok) {
    const all = summarizeRefunds([refund.body, ...(before.body.data ?? [])], received);
    return finishFromRefund(env, deps, order, actor, all ?? { ...refund.body, amount: refund.body.amount, partial: false, failure_reason: refund.body.failure_reason ?? null });
  }

  // Unknown or refused: Stripe's list says whether the refund was created after all.
  log("order.refund-failed", { orderId: order.id, stripe: describeFailure(refund) });
  const after = await listRefunds(stripe, piId);
  const settled = after.ok ? summarizeRefunds(after.body.data ?? [], received) : null;
  if (settled && settled.status !== "failed" && settled.status !== "canceled" && !settled.partial) {
    return finishFromRefund(env, deps, order, actor, settled);
  }
  if (failureKind(refund) === "unknown") return lockUnresolved(env, deps, order, actor, refund, "rejecting");
  if (failureKind(refund) === "missing") {
    return toReview(env, deps, order, "rejecting", actor, missingPaymentNote(piId, "no se ha devuelto nada"), { payment_status: "captured" });
  }
  return toReview(
    env,
    deps,
    order,
    "rejecting",
    actor,
    `Stripe no ha aceptado la devolución (${describeFailure(refund)}${refund.error?.message ? `: ${refund.error.message}` : ""}); el dinero sigue cobrado: pulsa RECHAZAR de nuevo para reintentarla`,
    { payment_status: "captured" },
  );
}

async function releaseAndFinish(env: Env, deps: Deps, order: OrderRow, actor: Actor): Promise<ActionResult> {
  const stripe = stripeClient(env, deps);
  const piId = order.stripe_payment_intent_id;
  if (!["authorized", "captured", "refund_failed"].includes(order.payment_status)) {
    return finishReject(env, deps, order, actor, {}, "Pedido rechazado. No había ningún pago que anular.");
  }
  if (!stripe || !piId) return toReview(env, deps, order, "rejecting", actor, "No hay un pago de Stripe asociado a este pedido");
  if (order.payment_status !== "authorized") return refundAndFinish(env, deps, stripe, order, actor);

  const { attempts } = await lockInfo(env.DB, order.id, "rejecting");
  const cancel = await cancelPaymentIntent(stripe, piId, `cancel-${order.id}-${Math.max(attempts, 1)}`);
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
  if (!cancel.ok) log("order.cancel-failed", { orderId: order.id, stripe: describeFailure(cancel) });
  const fresh = await retrievePaymentIntent(stripe, piId);
  if (!fresh.ok) return lockUnresolved(env, deps, order, actor, fresh, "rejecting");
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

/** Default age after which a lock is considered abandoned (see staleLockMs / LOCK_STALE_SECONDS). */
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
  if (!fresh.ok) return lockUnresolved(env, deps, order, actor, fresh, "accepting");
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
  if (synced.missing) {
    return fail(502, "payment-missing", `${missingPaymentNote(synced.missing, "no se puede confirmar el dinero")}.`, synced.order);
  }
  return { ok: true, order: synced.order, message: synced.changed ? "Estado actualizado desde Stripe." : "Todo está al día con Stripe." };
}
