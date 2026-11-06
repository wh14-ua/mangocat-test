import type { OrderStatus } from "../../../src/lib/commerce/types";
import { cleanText } from "../../../src/lib/commerce/validation";
import { formatClock } from "../../../src/lib/i18n/format";
import { lockReviewMs, lockTtlMs, PREP_MINUTES_MAX, PREP_MINUTES_MIN, staleLockMs } from "./config";
import { base64UrlEncode, randomBytes } from "./crypto";
import { getOrder, lockInfo, takeOverLock, updateOrderIf, type EventSource, type OrderPatch, type OrderRow } from "./db";
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
import { fetchPaymentFacts, missingPaymentNote, stripeClient, stripePatch, syncOrderPayment } from "./sync";
import { derivePaymentStatus } from "./payments";

/**
 * What staff can do from the panel. Each action:
 * 1. checks the order's current state and payment;
 * 2. takes a lock with a conditional UPDATE (awaiting_acceptance -> accepting / rejecting)
 *    that records an OWNER (lock_token) and an expiry: if two phones tap at the same time,
 *    exactly one wins and the other gets "ya gestionado"; and while the owner is working —
 *    talking to Stripe — nobody else (another phone's REINTENTAR, the cron) can finish or undo
 *    the lock: every later update of the owner is conditional on its token, and recovery may
 *    only take over a lock whose expiry has passed (longer than any request can take);
 * 3. talks to Stripe with an idempotency key per attempt (Stripe replays a stored answer —
 *    even a 500 — for a reused key; a PaymentIntent can only be captured or cancelled once,
 *    and a refund can never exceed what was charged, so a new attempt cannot double anything);
 * 4. finishes with another conditional UPDATE, writing who did what in order_events.
 * If the outcome at Stripe is unknown (timeout, 5xx), the lock stays and, once it expires, the
 * cron takes it over and decides from Stripe's real state — it reads the payment before doing
 * anything, never repeating an operation whose outcome it has not reconciled. If Stripe still
 * cannot tell after LOCK_REVIEW_SECONDS, or does not know the payment at all (404), the order
 * goes to EN REVISIÓN with what a person needs to act, and the staff are alerted. The kitchen
 * never sees an unpaid order, and no order stays locked indefinitely.
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
// Locks
// ---------------------------------------------------------------------------

function newLockToken(): string {
  return base64UrlEncode(randomBytes(16));
}

/** Patch that hands the lock back (every way out of accepting/rejecting uses it). */
const UNLOCK: OrderPatch = { lock_token: null, lock_expires_at: null };

/** Takes the accept/reject lock for this request; returns the locked row (with its token) or null. */
async function takeLock(
  env: Env,
  deps: Deps,
  order: OrderRow,
  to: "accepting" | "rejecting",
  patch: OrderPatch,
  actor: Actor,
  note: string,
): Promise<OrderRow | null> {
  const now = deps.now();
  const token = newLockToken();
  const expires = new Date(now.getTime() + lockTtlMs(env)).toISOString();
  const res = await updateOrderIf(env.DB, order.id, order.status, to, { ...patch, lock_token: token, lock_expires_at: expires }, {
    source: actor.source,
    actor: actor.label,
    note,
    now: now.toISOString(),
  });
  if (!res.ok) return null;
  return { ...order, ...patch, status: to, lock_token: token, lock_expires_at: expires, updated_at: now.toISOString() } as OrderRow;
}

/** Whether recovery may take this lock over: its owner's time is up (or it predates owners). */
export function lockExpired(env: Env, order: Pick<OrderRow, "lock_expires_at" | "updated_at">, now: Date): boolean {
  if (order.lock_expires_at) return Date.parse(order.lock_expires_at) <= now.getTime();
  return now.getTime() - Date.parse(order.updated_at) >= staleLockMs(env);
}

/** A status change made by the lock's owner (fails if the lock is no longer ours). */
function ownerUpdate(env: Env, order: OrderRow, to: OrderStatus | null, patch: OrderPatch, meta: Parameters<typeof updateOrderIf>[5], now: string) {
  return updateOrderIf(env.DB, order.id, order.status, to, to ? { ...patch, ...UNLOCK } : patch, meta, now, order.lock_token);
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
  const res = await ownerUpdate(
    env,
    order,
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
    now.toISOString(),
  );
  const updated = await reload(env, order.id, order);
  if (!res.ok) return alreadyHandled(updated);
  log("order.accepted", { orderId: order.id, minutes });
  return { ok: true, order: updated, message: `Pedido aceptado: listo en unos ${minutes} min.` };
}

/** Undoes an acceptance that charged nothing: back to where it was taken from (pending or review). */
async function revertAccept(env: Env, deps: Deps, order: OrderRow, patch: OrderPatch, note: string): Promise<OrderRow> {
  const now = deps.now().toISOString();
  const origin = (await lockInfo(env.DB, order.id, "accepting")).origin;
  const to: OrderStatus = origin === "needs_review" ? "needs_review" : "awaiting_acceptance";
  await ownerUpdate(env, order, to, patch, { source: "system", note, now }, now);
  return reload(env, order.id, order);
}

export async function acceptOrder(
  env: Env,
  deps: Deps,
  id: string,
  prepMinutes: unknown,
  actor: Actor,
  expected?: OrderStatus,
): Promise<ActionResult> {
  if (!validPrepMinutes(prepMinutes)) {
    return fail(422, "invalid-prep-minutes", `Indica un tiempo entre ${PREP_MINUTES_MIN} y ${PREP_MINUTES_MAX} minutos.`);
  }
  const order = await getOrder(env.DB, id);
  if (!order) return fail(404, "not-found", "No existe ese pedido.");
  if (order.status !== "awaiting_acceptance" && order.status !== "needs_review") return alreadyHandled(order);
  if (expected && order.status !== expected) return alreadyHandled(order);
  if (order.payment_status !== "authorized" && order.payment_status !== "captured") {
    return fail(409, "payment-not-ready", "El pago de este pedido no está confirmado. No lo prepares.", order);
  }
  const client = stripeClient(env, deps);
  if (order.payment_status === "authorized" && !client) {
    return fail(503, "payments-disabled", "No se puede cobrar ahora: los pagos no están configurados.", order);
  }

  const locked = await takeLock(env, deps, order, "accepting", { prep_minutes: prepMinutes }, actor, `Aceptado (${prepMinutes} min); cobrando el pago`);
  if (!locked) return alreadyHandled(await reload(env, id, order));

  // Paid by a method without a prior hold: nothing to capture, but the money must still be there.
  if (order.payment_status === "captured") return confirmCapturedAndFinish(env, deps, locked, actor, client);
  return captureAndFinish(env, deps, locked, actor, client);
}

/**
 * Accepting an order whose payment was charged at once: Stripe is read first (a refund made from
 * the Dashboard, or one still on its way as a webhook, must never reach the kitchen as "paid").
 */
async function confirmCapturedAndFinish(env: Env, deps: Deps, order: OrderRow, actor: Actor, client: StripeClient | null): Promise<ActionResult> {
  if (!client) return finishAccept(env, deps, order, actor, {});
  const fetched = await fetchPaymentFacts(client, order);
  const now = deps.now().toISOString();
  if (!fetched.ok) {
    await revertAccept(env, deps, order, {}, "No se pudo confirmar el pago con Stripe; el pedido vuelve a pendientes");
    return fail(503, "stripe-unavailable", "No se puede confirmar el pago con Stripe ahora mismo. Vuelve a pulsar ACEPTAR en unos segundos.", await reload(env, order.id, order));
  }
  if (fetched.missing || !fetched.facts) {
    return toReview(env, deps, order, "accepting", actor, missingPaymentNote(fetched.missing ?? order.stripe_payment_intent_id ?? "(sin id)", "no se puede confirmar el cobro"));
  }
  const payment = derivePaymentStatus(fetched.facts);
  if (payment === "captured") return finishAccept(env, deps, order, actor, stripePatch(order, fetched.facts, "captured", now));
  return toReview(
    env,
    deps,
    order,
    "accepting",
    actor,
    payment === "refunded" || payment === "refund_pending"
      ? "El pago se ha devuelto (o se está devolviendo) en Stripe: NO prepares este pedido"
      : `El pago no está cobrado en Stripe (estado «${fetched.facts.piStatus}»): NO prepares este pedido`,
    stripePatch(order, fetched.facts, payment, now),
  );
}

async function captureAndFinish(env: Env, deps: Deps, order: OrderRow, actor: Actor, client: StripeClient | null = null): Promise<ActionResult> {
  const stripe = client ?? stripeClient(env, deps);
  const piId = order.stripe_payment_intent_id;
  if (!stripe || !piId) return toReview(env, deps, order, "accepting", actor, "No hay un pago de Stripe asociado a este pedido");

  // Reconcile first: an earlier attempt (whose answer may have been lost) might have charged.
  const before = await retrievePaymentIntent(stripe, piId);
  if (!before.ok) return lockUnresolved(env, deps, order, actor, before, "accepting");
  if (before.body.status !== "requires_capture") return settleAccept(env, deps, order, actor, before.body, null);

  const { attempts } = await lockInfo(env.DB, order.id, "accepting");
  const capture = await capturePaymentIntent(stripe, piId, `capture-${order.id}-${Math.max(attempts, 1)}`);
  if (capture.ok && capture.body.status === "succeeded") {
    return finishAccept(env, deps, order, actor, stripePatch(order, factsFromIntent(capture.body), "captured", deps.now().toISOString()));
  }
  if (!capture.ok) log("order.capture-failed", { orderId: order.id, stripe: describeFailure(capture) });

  // The capture failed or its outcome is unknown: decide from Stripe's real state.
  const fresh = await retrievePaymentIntent(stripe, piId);
  if (!fresh.ok) return lockUnresolved(env, deps, order, actor, fresh, "accepting");
  return settleAccept(env, deps, order, actor, fresh.body, capture.ok ? null : capture);
}

/** The acceptance's outcome once Stripe's real state is known (live request or recovery). */
async function settleAccept(
  env: Env,
  deps: Deps,
  order: OrderRow,
  actor: Actor,
  pi: Parameters<typeof factsFromIntent>[0],
  failedCapture: Extract<StripeResult<unknown>, { ok: false }> | null,
  recovering = false,
): Promise<ActionResult> {
  const facts = factsFromIntent(pi);
  const now = deps.now().toISOString();
  switch (pi.status) {
    case "succeeded":
      return finishAccept(env, deps, order, actor, stripePatch(order, facts, "captured", now));
    case "requires_capture": {
      if (recovering) {
        // Nobody is waiting for this answer any more: make it visible instead of silently undoing it.
        return toReview(
          env,
          deps,
          order,
          "accepting",
          actor,
          `La aceptación de las ${formatClock(order.updated_at, "es")} no llegó a cobrarse (no se ha cobrado nada). Pulsa ACEPTAR de nuevo para prepararlo`,
          stripePatch(order, facts, "authorized", now),
        );
      }
      // Still capturable: nothing was charged; the decision can simply be retried.
      const reverted = await revertAccept(env, deps, order, stripePatch(order, facts, "authorized", now), "No se pudo cobrar en este momento; el pedido vuelve a pendientes");
      const why = failedCapture ? ` (Stripe: ${describeFailure(failedCapture)})` : "";
      return fail(502, "capture-failed", `No se ha podido cobrar ahora mismo${why}. No se ha cobrado nada. Vuelve a pulsar ACEPTAR en unos segundos.`, reverted);
    }
    case "canceled": {
      await ownerUpdate(env, order, "cancelled", stripePatch(order, facts, "canceled", now), {
        source: "system",
        note: "La autorización del pago ya no era válida; no se ha cobrado nada",
        now,
      }, now);
      return fail(
        409,
        "authorization-expired",
        "No se puede cobrar: la autorización del pago ha caducado o se ha anulado. NO prepares este pedido. No se ha cobrado nada al cliente.",
        await reload(env, order.id, order),
      );
    }
    default:
      return toReview(env, deps, order, "accepting", actor, `No se pudo cobrar: estado del pago en Stripe «${pi.status}»`);
  }
}

// ---------------------------------------------------------------------------
// Reject (also used for "cancel after accepting" and for automatic timeouts)
// ---------------------------------------------------------------------------

const REJECTABLE: readonly OrderStatus[] = ["awaiting_acceptance", "needs_review", "preparing", "ready"];

export async function rejectOrder(
  env: Env,
  deps: Deps,
  id: string,
  rawReason: unknown,
  actor: Actor,
  expected?: OrderStatus,
): Promise<ActionResult> {
  const reason = cleanText(rawReason, 200);
  const order = await getOrder(env.DB, id);
  if (!order) return fail(404, "not-found", "No existe ese pedido.");
  if (!REJECTABLE.includes(order.status)) return alreadyHandled(order);
  // The lock below is conditional on this same status, so the check holds until Stripe is called.
  if (expected && order.status !== expected) return alreadyHandled(order);
  // refund_failed: the money is still with the restaurant, so the refund must be retried.
  const needsStripe = ["authorized", "captured", "refund_failed"].includes(order.payment_status);
  const client = stripeClient(env, deps);
  if (needsStripe && !client) {
    return fail(503, "payments-disabled", "No se puede anular el pago ahora: los pagos no están configurados.", order);
  }
  const locked = await takeLock(env, deps, order, "rejecting", { rejection_reason: reason || null }, actor, reason ? `Rechazado: ${reason}` : "Rechazado");
  if (!locked) return alreadyHandled(await reload(env, id, order));
  return releaseAndFinish(env, deps, locked, actor);
}

async function finishReject(env: Env, deps: Deps, order: OrderRow, actor: Actor, patch: OrderPatch, note: string): Promise<ActionResult> {
  const now = deps.now().toISOString();
  const res = await ownerUpdate(env, order, "rejected", { ...patch, rejected_at: now, review_reason: null }, {
    source: actor.source,
    actor: actor.label,
    note,
    now,
  }, now);
  const updated = await reload(env, order.id, order);
  if (!res.ok) return alreadyHandled(updated);
  log("order.rejected", { orderId: order.id, payment: updated.payment_status });
  return { ok: true, order: updated, message: note };
}

async function toReview(env: Env, deps: Deps, order: OrderRow, from: OrderStatus, actor: Actor, reason: string, patch: OrderPatch = {}): Promise<ActionResult> {
  const now = deps.now().toISOString();
  const res = await ownerUpdate(env, { ...order, status: from }, "needs_review", { ...patch, review_reason: reason }, {
    source: "system",
    actor: actor.label,
    note: reason,
    now,
  }, now);
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
 * - no answer / 409 / 429 / 5xx: keep the lock (once it expires the cron takes it over and
 *   re-reads Stripe) until the deadline, then review with the facts: what was being done, since
 *   when, which payment.
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
  const counted = await ownerUpdate(env, order, null, { refund_attempts: attempt }, null, now);
  if (!counted.ok) return alreadyHandled(await reload(env, order.id, order));
  const remaining = received - (existing && existing.status !== "failed" && existing.status !== "canceled" ? existing.amount : 0);
  const refund = await createRefund(stripe, piId, `refund-${order.id}-${attempt}`, {
    order_id: order.id,
    order_number: String(order.number ?? ""),
  }, existing?.partial ? remaining : undefined);
  if (refund.ok) {
    const all = summarizeRefunds([refund.body, ...(before.body.data ?? [])], received) as RefundSummary;
    return finishFromRefund(env, deps, { ...order, refund_attempts: attempt }, actor, all);
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
    return toReview(env, deps, order, "rejecting", actor, missingPaymentNote(piId, "no se ha devuelto nada"));
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

/**
 * Releases the customer's money for a rejected order: cancels a hold, or refunds a charge.
 * Stripe's real state is read FIRST (a cancel or a capture from an earlier attempt, the cron
 * or the Dashboard may already have happened), so nothing is repeated blindly.
 */
async function releaseAndFinish(env: Env, deps: Deps, order: OrderRow, actor: Actor): Promise<ActionResult> {
  const stripe = stripeClient(env, deps);
  const piId = order.stripe_payment_intent_id;
  if (!["authorized", "captured", "refund_failed"].includes(order.payment_status)) {
    return finishReject(env, deps, order, actor, {}, "Pedido rechazado. No había ningún pago que anular.");
  }
  if (!stripe || !piId) return toReview(env, deps, order, "rejecting", actor, "No hay un pago de Stripe asociado a este pedido");
  if (order.payment_status !== "authorized") return refundAndFinish(env, deps, stripe, order, actor);

  const before = await retrievePaymentIntent(stripe, piId);
  if (!before.ok) return lockUnresolved(env, deps, order, actor, before, "rejecting");
  if (before.body.status !== "requires_capture") return settleRelease(env, deps, stripe, order, actor, before.body);

  const { attempts } = await lockInfo(env.DB, order.id, "rejecting");
  const cancel = await cancelPaymentIntent(stripe, piId, `cancel-${order.id}-${Math.max(attempts, 1)}`);
  if (cancel.ok && cancel.body.status === "canceled") return settleRelease(env, deps, stripe, order, actor, cancel.body);
  if (!cancel.ok) log("order.cancel-failed", { orderId: order.id, stripe: describeFailure(cancel) });
  const fresh = await retrievePaymentIntent(stripe, piId);
  if (!fresh.ok) return lockUnresolved(env, deps, order, actor, fresh, "rejecting");
  return settleRelease(env, deps, stripe, order, actor, fresh.body);
}

async function settleRelease(env: Env, deps: Deps, stripe: StripeClient, order: OrderRow, actor: Actor, pi: Parameters<typeof factsFromIntent>[0]): Promise<ActionResult> {
  const facts = factsFromIntent(pi);
  const now = deps.now().toISOString();
  switch (pi.status) {
    case "canceled":
      return finishReject(env, deps, order, actor, stripePatch(order, facts, "canceled", now), "Pedido rechazado. Autorización anulada: no se ha cobrado nada al cliente.");
    case "succeeded":
      // Captured meanwhile (an earlier acceptance, or the Dashboard): refund instead.
      return refundAndFinish(env, deps, stripe, { ...order, payment_status: "captured" }, actor);
    default:
      return toReview(env, deps, order, "rejecting", actor, "No se pudo anular la autorización del pago; pulsa RECHAZAR de nuevo", stripePatch(order, facts, "authorized", now));
  }
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
// Recovery: abandoned locks (cron) and the "retry" button
// ---------------------------------------------------------------------------

/** Default age after which a lock is considered abandoned (see staleLockMs / LOCK_STALE_SECONDS). */
export const STALE_LOCK_MS = 90_000;

/**
 * Finishes an accept/reject whose request died half-way. Only once the lock has expired — its
 * owner can no longer be working — and only after taking it over atomically (two recoverers
 * cannot both act). Then Stripe is read before anything is done: a captured payment finishes
 * the acceptance; a hold that was never captured goes to EN REVISIÓN (nobody is waiting for the
 * answer, so it is made visible rather than silently undone); a rejection finishes the release
 * or refund from Stripe's state.
 */
export async function recoverLock(env: Env, deps: Deps, order: OrderRow, actor: Actor): Promise<ActionResult> {
  if (order.status !== "accepting" && order.status !== "rejecting") return { ok: true, order, message: "Sin cambios." };
  const now = deps.now();
  if (!lockExpired(env, order, now)) return alreadyHandled(order);
  const token = newLockToken();
  const expires = new Date(now.getTime() + lockTtlMs(env)).toISOString();
  if (!(await takeOverLock(env.DB, order, token, expires, now.toISOString()))) return alreadyHandled(await reload(env, order.id, order));
  const owned: OrderRow = { ...order, lock_token: token, lock_expires_at: expires, updated_at: now.toISOString() };
  log("order.lock-recovered", { orderId: order.id, status: order.status });
  if (owned.status === "rejecting") return releaseAndFinish(env, deps, owned, actor);

  const stripe = stripeClient(env, deps);
  if (!stripe || !owned.stripe_payment_intent_id) {
    if (owned.payment_status === "captured") return confirmCapturedAndFinish(env, deps, owned, actor, stripe);
    return toReview(env, deps, owned, "accepting", actor, "No hay un pago de Stripe asociado a este pedido");
  }
  const fresh = await retrievePaymentIntent(stripe, owned.stripe_payment_intent_id);
  if (!fresh.ok) return lockUnresolved(env, deps, owned, actor, fresh, "accepting");
  return settleAccept(env, deps, owned, actor, fresh.body, null, true);
}

/** @deprecated kept for callers outside this module; use recoverLock. */
export const resolveLock = recoverLock;

/** Staff "retry": re-read Stripe and finish whatever was left half-done (never a lock still in use). */
export async function retryOrder(env: Env, deps: Deps, id: string, actor: Actor): Promise<ActionResult> {
  const order = await getOrder(env.DB, id);
  if (!order) return fail(404, "not-found", "No existe ese pedido.");
  if (order.status === "accepting" || order.status === "rejecting") return recoverLock(env, deps, order, actor);
  const synced = await syncOrderPayment(env, deps, id, { source: actor.source, actor: actor.label });
  if (!synced.ok) {
    return fail(502, synced.reason, synced.reason === "payments-disabled" ? "Los pagos no están configurados." : "Stripe no responde. Inténtalo en un minuto.", order);
  }
  if (synced.missing) {
    return fail(502, "payment-missing", `${missingPaymentNote(synced.missing, "no se puede confirmar el dinero")}.`, synced.order);
  }
  return { ok: true, order: synced.order, message: synced.changed ? "Estado actualizado desde Stripe." : "Todo está al día con Stripe." };
}
