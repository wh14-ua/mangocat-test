/** Spanish formatting and wording for the panel (money in es-ES euros, times in Madrid). */
import type { AlertState, Card, OrderStatus, PaymentStatus, PaymentsMode } from "./types";

const TIME_ZONE = "Europe/Madrid";

const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const clockFmt = new Intl.DateTimeFormat("es-ES", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const clockSecFmt = new Intl.DateTimeFormat("es-ES", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const dayFmt = new Intl.DateTimeFormat("es-ES", { timeZone: TIME_ZONE, day: "numeric", month: "short" });
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/** 2540 -> "25,40 €" (integer cents, no float drift). */
export function euros(cents: number): string {
  return money.format(Math.trunc(cents / 100) + (cents % 100) / 100);
}

function parse(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/** "13:42" in Madrid time. */
export function clock(iso: string | null | undefined): string {
  const ms = parse(iso);
  return ms === null ? "—" : clockFmt.format(ms);
}

export function clockAt(ms: number): string {
  return clockFmt.format(ms);
}

export function clockWithSeconds(ms: number): string {
  return clockSecFmt.format(ms);
}

/** "13:42" today, "4 nov, 13:42" another day. */
export function stamp(iso: string | null | undefined, nowMs: number): string {
  const ms = parse(iso);
  if (ms === null) return "—";
  const sameDay = dayKeyFmt.format(ms) === dayKeyFmt.format(nowMs);
  return sameDay ? clockFmt.format(ms) : `${dayFmt.format(ms).replace(".", "")}, ${clockFmt.format(ms)}`;
}

/** "45 min", "1 h", "1 h 5 min". */
export function minutesText(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const hours = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** Relative age for orders: "ahora mismo", "hace 3 min", "hace 1 h 12 min". */
export function ago(iso: string | null | undefined, nowMs: number): string {
  const ms = parse(iso);
  if (ms === null) return "";
  const minutes = Math.floor(Math.max(0, nowMs - ms) / 60_000);
  return minutes < 1 ? "ahora mismo" : `hace ${minutesText(minutes)}`;
}

/** Relative age with seconds, for "Actualizado hace 5 s". */
export function agoSeconds(ms: number, nowMs: number): string {
  const seconds = Math.max(0, Math.round((nowMs - ms) / 1000));
  if (seconds < 60) return `hace ${seconds} s`;
  return `hace ${minutesText(Math.floor(seconds / 60))}`;
}

export function orderRef(card: Pick<Card, "number" | "id">): string {
  return card.number !== null && card.number !== undefined ? `#${card.number}` : `#${card.id}`;
}

export function itemsText(count: number): string {
  return count === 1 ? "1 producto" : `${count} productos`;
}

export type Tone = "info" | "ok" | "muted" | "warn" | "danger";

export const PAYMENT_TEXT: Record<PaymentStatus, { label: string; tone: Tone }> = {
  authorized: { label: "Pago autorizado · se cobra al aceptar", tone: "info" },
  captured: { label: "Cobrado", tone: "ok" },
  canceled: { label: "Anulado · no se cobró", tone: "muted" },
  refund_pending: { label: "Devolución solicitada, pendiente de Stripe", tone: "warn" },
  refunded: { label: "Devuelto al cliente", tone: "muted" },
  refund_failed: { label: "Devolución fallida · ¡revisar!", tone: "danger" },
  unpaid: { label: "Sin pagar", tone: "warn" },
  processing: { label: "Pago en curso", tone: "warn" },
  failed: { label: "Pago fallido", tone: "danger" },
};

export const STATUS_TEXT: Record<OrderStatus, string> = {
  pending: "Pago pendiente",
  awaiting_acceptance: "Pendiente de aceptar",
  accepting: "Aceptando",
  rejecting: "Rechazando",
  preparing: "En preparación",
  ready: "Listo para recoger",
  completed: "Entregado",
  rejected: "Rechazado",
  failed: "Pago no completado",
  cancelled: "Cancelado",
  needs_review: "En revisión",
};

export function statusText(status: string): string {
  return (STATUS_TEXT as Record<string, string>)[status] ?? status;
}

export const SOURCE_TEXT: Record<string, string> = {
  checkout: "Web",
  stripe: "Stripe",
  staff: "Personal",
  system: "Sistema",
};

export const ALERT_TEXT: Record<AlertState, string | null> = {
  sent: "Aviso Telegram enviado",
  pending: "Aviso Telegram pendiente",
  failed: "Aviso Telegram fallido",
  none: null,
};

export const NOTIFICATION_KIND_TEXT: Record<string, string> = {
  new_order: "Pedido nuevo",
  reminder: "Recordatorio",
  auto_cancelled: "Cancelado automáticamente",
  needs_review: "En revisión",
};

export const NOTIFICATION_STATUS_TEXT: Record<string, string> = {
  sent: "Enviado",
  pending: "Pendiente",
  sending: "Enviando",
  failed: "Fallido",
  skipped: "Omitido",
};

/** Stripe's own words, translated for staff (the raw value is shown next to it). */
export const STRIPE_STATUS_TEXT: Record<string, string> = {
  requires_payment_method: "Sin método de pago",
  requires_confirmation: "Pendiente de confirmar",
  requires_action: "Esperando al cliente",
  processing: "Procesando",
  requires_capture: "Autorizado, sin cobrar",
  canceled: "Anulado",
  succeeded: "Cobrado",
};

export const REFUND_STATUS_TEXT: Record<string, string> = {
  pending: "Pendiente",
  requires_action: "Requiere acción",
  succeeded: "Devuelto",
  failed: "Fallida",
  canceled: "Cancelada",
};

export const MODE_TEXT: Record<PaymentsMode, string> = {
  "stripe-test": "PRUEBA",
  "stripe-live": "REAL",
  disabled: "DESACTIVADO",
};

/** What rejecting does with the customer's money, said before the staff confirms. */
export function rejectMoneyText(card: Pick<Card, "paymentStatus" | "totalCents">): string {
  switch (card.paymentStatus) {
    case "authorized":
      return "Se anulará la reserva del importe: no se cobrará nada al cliente.";
    case "captured":
      return `Se devolverá el importe cobrado (${euros(card.totalCents)}) al cliente.`;
    case "refund_failed":
      return `La devolución anterior falló. Se volverá a intentar devolver el importe cobrado (${euros(card.totalCents)}).`;
    case "refund_pending":
      return "La devolución ya está solicitada a Stripe.";
    default:
      return "No hay ningún pago que anular: no se ha cobrado nada.";
  }
}

/** What accepting does with the customer's money. */
export function acceptMoneyText(card: Pick<Card, "paymentStatus" | "totalCents">): string {
  return card.paymentStatus === "captured"
    ? `El pago (${euros(card.totalCents)}) ya está cobrado.`
    : `Al aceptar se cobrarán ${euros(card.totalCents)} al cliente.`;
}

/** Only E.164 numbers become tel: links. */
export function telHref(phone: string): string | null {
  return /^\+[1-9]\d{6,14}$/.test(phone) ? `tel:${phone}` : null;
}

export function mailHref(email: string): string | null {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email) ? `mailto:${email}` : null;
}

export const ORDER_ID = /^SH-\d{6}-[A-Z0-9]{6}$/;
