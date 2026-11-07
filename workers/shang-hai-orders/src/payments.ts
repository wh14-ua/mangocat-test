import type { OrderStatus, PaymentStatus } from "../../../src/lib/commerce/types";
import type { StripeCharge, StripePaymentIntent, StripeRefund } from "./stripe";

/**
 * Pure reconciliation between what Stripe reports and what the order says.
 *
 * Every webhook (whatever its type, order or number of deliveries) and every cron pass
 * re-reads the PaymentIntent from Stripe and runs it through these functions, so the
 * order converges on Stripe's real state: duplicated or out-of-order events cannot move
 * an order backwards, and nothing is trusted from the event payload except ids.
 */

export type PaymentFacts = {
  paymentIntentId: string;
  piStatus: StripePaymentIntent["status"];
  amount: number;
  amountCapturable: number;
  amountReceived: number;
  currency: string;
  livemode: boolean;
  metadataOrderId: string | null;
  cancellationReason: string | null;
  /** A payment attempt failed (card declined…) and the intent is waiting for another method. */
  failedAttempt: boolean;
  /** Amount refunded on the charge (refunds made from the Dashboard included). */
  chargeRefunded: number;
  /** Card authorisations must be captured before this time (ISO), when Stripe reports it. */
  captureBefore: string | null;
  /** The refunds of this payment (ours, lost answers and Dashboard ones), summarised. */
  refund: RefundSummary | null;
};

export type RefundSummary = Pick<StripeRefund, "id" | "status" | "failure_reason"> & {
  /** Amount covered by refunds that have not failed (pending ones included). */
  amount: number;
  /** Those refunds cover less than what was charged (e.g. a partial refund from the Dashboard). */
  partial: boolean;
};

/**
 * One status for all the refunds of a payment: "succeeded" only when every live refund has
 * succeeded AND together they cover what was charged; "pending" while any is unconfirmed;
 * failed/canceled only when no live refund is left. Stripe lists newest first.
 */
export function summarizeRefunds(refunds: readonly StripeRefund[], received: number): RefundSummary | null {
  if (!refunds.length) return null;
  const alive = refunds.filter((r) => r.status !== "failed" && r.status !== "canceled");
  const latest = alive[0] ?? refunds[0];
  if (!alive.length) return { id: latest.id, status: latest.status, amount: 0, failure_reason: latest.failure_reason ?? null, partial: false };
  const amount = alive.reduce((n, r) => n + (r.amount ?? 0), 0);
  const unconfirmed = alive.some((r) => r.status !== "succeeded");
  return { id: latest.id, status: unconfirmed ? "pending" : "succeeded", amount, failure_reason: null, partial: received > 0 && amount < received };
}

export function factsFromIntent(pi: StripePaymentIntent, refunds?: readonly StripeRefund[] | StripeRefund | null): PaymentFacts {
  const charge: StripeCharge | null = typeof pi.latest_charge === "object" && pi.latest_charge ? pi.latest_charge : null;
  const captureBefore = charge?.payment_method_details?.card?.capture_before;
  return {
    paymentIntentId: pi.id,
    piStatus: pi.status,
    amount: pi.amount,
    amountCapturable: pi.amount_capturable ?? 0,
    amountReceived: pi.amount_received ?? 0,
    currency: (pi.currency ?? "").toLowerCase(),
    livemode: Boolean(pi.livemode),
    metadataOrderId: pi.metadata?.order_id ?? null,
    cancellationReason: pi.cancellation_reason ?? null,
    failedAttempt: Boolean(pi.last_payment_error),
    chargeRefunded: charge?.amount_refunded ?? 0,
    captureBefore: typeof captureBefore === "number" ? new Date(captureBefore * 1000).toISOString() : null,
    refund: summarizeRefunds(refunds ? (Array.isArray(refunds) ? refunds : [refunds as StripeRefund]) : [], pi.amount_received ?? 0),
  };
}

export function derivePaymentStatus(f: PaymentFacts): PaymentStatus {
  switch (f.piStatus) {
    case "requires_capture":
      return "authorized";
    case "processing":
      return "processing";
    case "canceled":
      return "canceled";
    case "succeeded":
      if (f.refund) {
        if (f.refund.status === "failed" || f.refund.status === "canceled") return "refund_failed";
        if (f.refund.partial) return "captured"; // partly refunded: most of the money is still charged
        if (f.refund.status === "succeeded") return "refunded";
        return "refund_pending"; // pending / requires_action: not confirmed yet
      }
      // Refunded according to the charge, but no refund object confirms it: not "refunded" yet.
      if (f.amountReceived > 0 && f.chargeRefunded >= f.amountReceived) return "refund_pending";
      return "captured";
    case "requires_payment_method":
      return f.failedAttempt ? "failed" : "unpaid";
    default:
      return "unpaid"; // requires_confirmation, requires_action (3-D Secure in progress)
  }
}

export type OrderPaymentState = {
  id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  total_cents: number;
  payments_mode: "stripe-test" | "stripe-live";
};

/** Amount, currency, mode and order id must match what we created; anything else needs a human. */
export function paymentMismatch(order: OrderPaymentState, f: PaymentFacts): string | null {
  if (f.metadataOrderId && f.metadataOrderId !== order.id) return "El pago de Stripe pertenece a otro pedido";
  if (f.amount !== order.total_cents) {
    return `Importe en Stripe (${f.amount}) distinto del total del pedido (${order.total_cents})`;
  }
  if (f.currency !== "eur") return "Moneda distinta de EUR";
  if (f.livemode !== (order.payments_mode === "stripe-live")) {
    return "El modo (pruebas/real) del pago no coincide con el del pedido";
  }
  return null;
}

export type PaymentPlan = {
  paymentStatus: PaymentStatus;
  /** New commercial status, or null to keep the current one. */
  to: OrderStatus | null;
  note: string;
  /** Why a human must look at it (stored and shown in the panel). */
  reviewReason: string | null;
  /** The order has just reached the restaurant: alert the staff. */
  notifyNewOrder: boolean;
};

const PLACED: readonly PaymentStatus[] = ["authorized", "captured"];

/**
 * What the order should become given Stripe's facts. Lock statuses (accepting /
 * rejecting) are left to the staff action that holds them (or to stale-lock recovery):
 * only the payment status is refreshed.
 */
export function planFromPayment(order: OrderPaymentState, f: PaymentFacts): PaymentPlan {
  const paymentStatus = derivePaymentStatus(f);
  const keep = (note: string): PaymentPlan => ({ paymentStatus, to: null, note, reviewReason: null, notifyNewOrder: false });
  const review = (reason: string): PaymentPlan => ({
    paymentStatus,
    to: order.status === "needs_review" ? null : "needs_review",
    note: reason,
    reviewReason: reason,
    notifyNewOrder: false,
  });

  // Amount / currency / mode / order are checked while the payment is being placed. Once a
  // person has accepted the order (after reviewing it), its own capture must not bounce it back.
  const mismatch = paymentMismatch(order, f);
  if (mismatch && ["pending", "failed", "awaiting_acceptance"].includes(order.status)) return review(mismatch);

  switch (order.status) {
    case "pending":
    case "failed":
      if (PLACED.includes(paymentStatus)) {
        return {
          paymentStatus,
          to: "awaiting_acceptance",
          note:
            paymentStatus === "authorized"
              ? "Pago autorizado por Stripe (importe reservado, sin cobrar); pendiente de aceptación"
              : "Pago cobrado por Stripe (método sin autorización previa); pendiente de aceptación",
          reviewReason: null,
          notifyNewOrder: true,
        };
      }
      if (paymentStatus === "failed") {
        return order.status === "failed"
          ? keep("Nuevo intento de pago fallido")
          : { paymentStatus, to: "failed", note: "El pago no se ha completado", reviewReason: null, notifyNewOrder: false };
      }
      if (paymentStatus === "canceled") {
        return { paymentStatus, to: "cancelled", note: "Pago cancelado en Stripe", reviewReason: null, notifyNewOrder: false };
      }
      if (paymentStatus === "processing") return keep("Pago en proceso en Stripe");
      if (paymentStatus === "unpaid") return keep("Pago todavía no completado");
      return review("Reembolso registrado en Stripe para un pedido sin pagar");

    case "awaiting_acceptance":
      if (PLACED.includes(paymentStatus)) return keep("Pago confirmado sin cambios");
      if (paymentStatus === "canceled") {
        return {
          paymentStatus,
          to: "cancelled",
          note:
            f.cancellationReason === "expired"
              ? "La autorización del pago caducó antes de aceptar el pedido; no se ha cobrado nada"
              : "La autorización del pago se anuló en Stripe; no se ha cobrado nada",
          reviewReason: null,
          notifyNewOrder: false,
        };
      }
      if (paymentStatus === "refunded" || paymentStatus === "refund_pending") {
        return review("Se ha reembolsado el pago desde Stripe sin rechazar el pedido");
      }
      return review(`Estado de pago inesperado en Stripe (${f.piStatus})`);

    case "accepting":
    case "rejecting":
      return keep("Estado de pago actualizado durante una acción del personal");

    case "preparing":
    case "ready":
      if (paymentStatus === "captured") return keep("Pago confirmado sin cambios");
      if (paymentStatus === "refunded" || paymentStatus === "refund_pending") {
        return review("Se ha reembolsado el pago desde Stripe con el pedido en curso");
      }
      return review(`Estado de pago inesperado en Stripe (${f.piStatus}) con el pedido en curso`);

    case "completed":
      return keep(paymentStatus === "captured" ? "Pago confirmado sin cambios" : "Estado de pago actualizado tras la entrega");

    case "rejected":
      if (paymentStatus === "canceled" || paymentStatus === "refunded" || paymentStatus === "refund_pending") {
        return keep(paymentStatus === "refunded" ? "Stripe ha confirmado el reembolso" : "Estado de devolución actualizado");
      }
      if (paymentStatus === "refund_failed") {
        return review(`La devolución ha fallado en Stripe${f.refund?.failure_reason ? ` (${f.refund.failure_reason})` : ""}`);
      }
      return review(`Pedido rechazado pero el pago sigue ${paymentStatus === "authorized" ? "autorizado" : "cobrado"} en Stripe`);

    case "cancelled":
      if (PLACED.includes(paymentStatus)) return review("Pago recibido para un pedido ya cancelado");
      return keep("Estado de pago actualizado");

    case "needs_review":
      return keep("Estado de pago actualizado (pedido en revisión)");
  }
}
