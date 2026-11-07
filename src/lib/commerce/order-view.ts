import { defineMessages, type Locale } from "../i18n/locale";
import { formatClock } from "../i18n/format";
import { ORDER_STATUS_TEXT, PAYMENT_STATUS_TEXT } from "./messages";
import { isSettled } from "./orders";
import type { OrderStatus, OrderSummary, PaymentStatus } from "./types";

/**
 * Customer-facing reading of an order, shared by the three storefronts so they all tell
 * the same truth in their own design: commercial progress and money are separate lines,
 * the preparation time is only shown when the restaurant has set it, and polling slows
 * down (or stops) as the order settles.
 */

export type OrderTone = "waiting" | "progress" | "success" | "negative" | "attention";

export type OrderStepId = "received" | "accepted" | "preparing" | "ready" | "collected";

export type OrderStep = { id: OrderStepId; label: string; state: "done" | "current" | "todo" };

export type OrderEta = {
  /** ISO time the restaurant expects the order to be ready. */
  readyBy: string;
  /** "14:05" (Madrid time). */
  clock: string;
  minutes: number;
  /** "Listo hacia las 14:05 (unos 20 min)". */
  text: string;
};

export type OrderView = {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  headline: string;
  detail: string;
  tone: OrderTone;
  payment: { label: string; detail: string; tone: OrderTone };
  eta: OrderEta | null;
  /** The happy-path timeline, or null when the order left it (rejected, cancelled…). */
  steps: OrderStep[] | null;
  rejectionReason: string | null;
  /** Offer to go back to the order and pay again (failed or abandoned payment). */
  canRetryCheckout: boolean;
  /** Nothing left to wait for: stop refreshing. */
  settled: boolean;
  /** Suggested refresh interval in ms (0 = stop). */
  refreshMs: number;
};

export const ORDER_VIEW_TEXT = defineMessages({
  es: {
    steps: {
      received: "Pedido recibido",
      accepted: "Aceptado",
      preparing: "En preparación",
      ready: "Listo para recoger",
      collected: "Entregado",
    } satisfies Record<OrderStepId, string>,
    eta: (clock: string, minutes: number) => `Listo hacia las ${clock} (en unos ${minutes} min)`,
    etaDue: (clock: string) => `Debería estar listo enseguida (previsto para las ${clock})`,
    etaPlanned: (clock: string) => `Previsto para las ${clock}`,
    rejectingRefund: "El restaurante no puede preparar tu pedido. Estamos devolviendo el importe cobrado.",
    etaLabel: "Hora estimada",
    etaSource: (minutes: number) => `Tiempo de preparación indicado por el restaurante: ${minutes} min.`,
    readyAt: (clock: string) => `Listo desde las ${clock}`,
    reasonLabel: "Motivo indicado por el restaurante",
    progressLabel: "Progreso del pedido",
    paymentLabel: "Pago",
    lastUpdate: (clock: string) => `Actualizado a las ${clock}`,
  },
  en: {
    steps: {
      received: "Order received",
      accepted: "Accepted",
      preparing: "Being prepared",
      ready: "Ready for pickup",
      collected: "Collected",
    } satisfies Record<OrderStepId, string>,
    eta: (clock: string, minutes: number) => `Ready around ${clock} (in about ${minutes} min)`,
    etaDue: (clock: string) => `Should be ready any minute (planned for ${clock})`,
    etaPlanned: (clock: string) => `Planned for ${clock}`,
    rejectingRefund: "The restaurant cannot prepare your order. We are returning the amount charged.",
    etaLabel: "Estimated time",
    etaSource: (minutes: number) => `Preparation time given by the restaurant: ${minutes} min.`,
    readyAt: (clock: string) => `Ready since ${clock}`,
    reasonLabel: "Reason given by the restaurant",
    progressLabel: "Order progress",
    paymentLabel: "Payment",
    lastUpdate: (clock: string) => `Updated at ${clock}`,
  },
});

const STEP_ORDER: OrderStepId[] = ["received", "accepted", "preparing", "ready", "collected"];

/** Index of the current step on the happy path, or null when off it. */
function currentStep(status: OrderStatus): number | null {
  switch (status) {
    // Until the restaurant accepts, "received" is where the order is: "accepted" must never
    // read as current (or be announced as such) before it happened.
    case "pending":
    case "awaiting_acceptance":
    case "accepting":
      return 0;
    case "preparing":
      return 2;
    case "ready":
      return 3;
    case "completed":
      return STEP_ORDER.length; // everything done
    default:
      return null;
  }
}

function orderTone(status: OrderStatus): OrderTone {
  switch (status) {
    case "preparing":
      return "progress";
    case "ready":
    case "completed":
      return "success";
    case "rejected":
    case "rejecting":
    case "failed":
    case "cancelled":
      return "negative";
    case "needs_review":
      return "attention";
    default:
      return "waiting";
  }
}

function paymentTone(payment: PaymentStatus): OrderTone {
  switch (payment) {
    case "captured":
    case "refunded":
      return "success";
    case "canceled":
      return "success";
    case "failed":
      return "negative";
    case "refund_failed":
      return "attention";
    default:
      return "waiting";
  }
}

function refreshInterval(order: Pick<OrderSummary, "status" | "paymentStatus">): number {
  if (isSettled(order)) return 0;
  switch (order.status) {
    case "pending":
      return 3_000;
    case "awaiting_acceptance":
    case "accepting":
    case "rejecting":
      return 5_000;
    case "preparing":
      return 10_000;
    default:
      return 20_000;
  }
}

export function describeOrder(order: OrderSummary, locale: Locale, now: Date = new Date()): OrderView {
  const t = ORDER_VIEW_TEXT[locale];
  const statusText = ORDER_STATUS_TEXT[locale][order.status];
  const paymentText = PAYMENT_STATUS_TEXT[locale][order.paymentStatus];

  const index = currentStep(order.status);
  const steps =
    index === null
      ? null
      : STEP_ORDER.map((id, i) => ({
          id,
          label: t.steps[id],
          state: (i < index ? "done" : i === index ? "current" : "todo") as OrderStep["state"],
        }));

  // Only a time the restaurant actually set; never an estimate of our own. The words follow
  // the clock: minutes left while there are some, "any minute" once the time has passed.
  let eta: OrderEta | null = null;
  if (order.prepMinutes && order.readyBy && (order.status === "preparing" || order.status === "ready")) {
    const clock = formatClock(order.readyBy, locale);
    const left = Math.ceil((Date.parse(order.readyBy) - now.getTime()) / 60_000);
    eta = {
      readyBy: order.readyBy,
      clock,
      minutes: order.prepMinutes,
      text: order.status === "ready" ? t.etaPlanned(clock) : left > 0 ? t.eta(clock, Math.min(left, order.prepMinutes)) : t.etaDue(clock),
    };
  }
  const refunding = order.status === "rejecting" && ["captured", "refund_pending", "refund_failed"].includes(order.paymentStatus);

  return {
    status: order.status,
    paymentStatus: order.paymentStatus,
    headline: statusText.label,
    detail: refunding ? t.rejectingRefund : statusText.detail,
    tone: orderTone(order.status),
    payment: { label: paymentText.label, detail: paymentText.detail, tone: paymentTone(order.paymentStatus) },
    eta,
    steps,
    rejectionReason:
      (order.status === "rejected" || order.status === "rejecting") && order.rejectionReason
        ? localizeRejectionReason(order.rejectionReason, locale)
        : null,
    canRetryCheckout: order.status === "failed" || (order.status === "cancelled" && order.paymentStatus !== "canceled"),
    settled: isSettled(order),
    refreshMs: refreshInterval(order),
  };
}

/**
 * Reasons the system or the panel's quick buttons write (in Spanish) as the customer reads
 * them. Free text typed by staff is shown as written.
 */
const KNOWN_REASONS: Record<string, { en: string }> = {
  "El restaurante no ha podido confirmar el pedido a tiempo": { en: "The restaurant could not confirm your order in time" },
  "Sin existencias": { en: "Out of stock" },
  "Cocina cerrada": { en: "The kitchen is closed" },
  "Demasiados pedidos": { en: "Too many orders right now" },
  "Fuera de horario": { en: "Outside opening hours" },
};

export function localizeRejectionReason(reason: string, locale: Locale): string {
  if (locale === "es") return reason;
  return KNOWN_REASONS[reason.trim()]?.en ?? reason;
}
