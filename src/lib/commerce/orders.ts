import type { OrderStatus, PaymentStatus } from "./types";
import { ORDER_STATUS_TEXT } from "./messages";

/**
 * Allowed commercial status transitions.
 *
 * - Payment outcomes (pending -> awaiting_acceptance / failed / cancelled) come only from
 *   verified Stripe data.
 * - The restaurant decides: awaiting_acceptance -> accepting | rejecting (staff), and the
 *   server finishes the job once Stripe confirms: accepting -> preparing (captured) and
 *   rejecting -> rejected (authorisation released or refund requested).
 * - accepting -> awaiting_acceptance happens when the capture could not even be attempted
 *   (Stripe unreachable): the decision can be retried; nothing was charged.
 * - Anything that does not add up goes to needs_review, which staff can resolve by
 *   accepting, rejecting (refund / release) or closing it as cancelled.
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["awaiting_acceptance", "failed", "cancelled", "needs_review"],
  failed: ["awaiting_acceptance", "cancelled", "needs_review"],
  awaiting_acceptance: ["accepting", "rejecting", "cancelled", "needs_review"],
  accepting: ["preparing", "awaiting_acceptance", "cancelled", "needs_review"],
  rejecting: ["rejected", "needs_review"],
  preparing: ["ready", "rejecting", "needs_review"],
  ready: ["completed", "rejecting", "needs_review"],
  needs_review: ["accepting", "rejecting", "cancelled"],
  rejected: ["needs_review"],
  cancelled: ["needs_review"],
  completed: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Statuses a staff member may request directly (the server completes the rest). */
export const STAFF_TARGETS = ["accepting", "rejecting", "ready", "completed"] as const;

/** Orders waiting for a human decision in the panel. */
export const DECISION_STATUSES: readonly OrderStatus[] = ["awaiting_acceptance", "needs_review"];

/** Short-lived locks while Stripe is called; a stale lock is resolved by reconciliation. */
export const LOCK_STATUSES: readonly OrderStatus[] = ["accepting", "rejecting"];

/** No further commercial changes are expected (the money may still settle: see isSettled). */
export function isFinalStatus(status: OrderStatus): boolean {
  return status === "completed" || status === "rejected" || status === "cancelled";
}

/** Payment states that will still change by themselves (Stripe has not finished). */
export function isPaymentInFlight(payment: PaymentStatus): boolean {
  return payment === "processing" || payment === "refund_pending";
}

/** Nothing left to wait for: the customer's status page can stop polling. */
export function isSettled(order: { status: OrderStatus; paymentStatus: PaymentStatus }): boolean {
  return isFinalStatus(order.status) && !isPaymentInFlight(order.paymentStatus);
}

/**
 * Orders stored before the acceptance flow (status "paid": charged immediately, waiting
 * for the kitchen) become "awaiting_acceptance" with a captured payment, so they keep
 * working: accepting needs no capture and rejecting refunds them.
 */
export function normalizeLegacyStatus(
  status: string,
  paymentStatus?: string | null,
): { status: OrderStatus; paymentStatus: PaymentStatus } {
  const known = status in TRANSITIONS ? (status as OrderStatus) : null;
  const payment = (paymentStatus ?? null) as PaymentStatus | null;
  if (status === "paid") return { status: "awaiting_acceptance", paymentStatus: payment ?? "captured" };
  if (!known) return { status: "needs_review", paymentStatus: payment ?? "unpaid" };
  if (payment) return { status: known, paymentStatus: payment };
  const inferred: PaymentStatus =
    known === "preparing" || known === "ready" || known === "completed"
      ? "captured"
      : known === "failed"
        ? "failed"
        : "unpaid";
  return { status: known, paymentStatus: inferred };
}

/** Spanish labels (staff panel, logs). Customer-facing copy lives in messages.ts. */
export const ORDER_STATUS_COPY = ORDER_STATUS_TEXT.es;
