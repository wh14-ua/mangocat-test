import type { OrderStatus } from "./types";

/**
 * Allowed status transitions. Payment outcomes (paid/failed/cancelled from pending) are
 * set only by verified payment events; kitchen states are set only by authenticated
 * staff. Everything else is rejected.
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["paid", "failed", "cancelled", "needs_review"],
  failed: ["paid", "cancelled"],
  needs_review: ["paid", "cancelled"],
  paid: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed"],
  cancelled: [],
  completed: [],
};

/** Transitions that only staff may trigger (never the payment webhook). */
export const STAFF_TRANSITIONS: readonly OrderStatus[] = ["preparing", "ready", "completed"];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export const ORDER_STATUS_COPY: Record<OrderStatus, { label: string; detail: string }> = {
  pending: {
    label: "Pendiente de pago",
    detail: "Estamos esperando la confirmación del pago.",
  },
  paid: {
    label: "Pagado",
    detail: "Pago confirmado. El restaurante ha recibido el pedido.",
  },
  failed: {
    label: "Pago no completado",
    detail: "El pago no se ha completado. No se ha realizado ningún cargo.",
  },
  cancelled: {
    label: "Cancelado",
    detail: "El pedido se ha cancelado.",
  },
  preparing: {
    label: "En preparación",
    detail: "La cocina está preparando tu pedido.",
  },
  ready: {
    label: "Listo para recoger",
    detail: "Tu pedido está listo. Pasa a recogerlo.",
  },
  completed: {
    label: "Entregado",
    detail: "Pedido recogido. ¡Que aproveche!",
  },
  needs_review: {
    label: "En revisión",
    detail: "El restaurante está revisando el pago de este pedido.",
  },
};

/** The happy path shown as a progress timeline. */
export const ORDER_PROGRESS: readonly OrderStatus[] = [
  "pending",
  "paid",
  "preparing",
  "ready",
  "completed",
];

export function progressIndex(status: OrderStatus): number {
  return ORDER_PROGRESS.indexOf(status);
}

export function isFinalStatus(status: OrderStatus): boolean {
  return status === "completed" || status === "cancelled";
}
