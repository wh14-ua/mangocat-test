import type { CheckoutRequest, OrderStatus, OrderSummary } from "../types";
import type { FieldErrors } from "../validation";
import type { QuoteIssue } from "../pricing";

export type PaymentsMode = "demo" | "stripe-test" | "stripe-live" | "disabled";

export type CheckoutSuccess = {
  ok: true;
  orderId: string;
  orderToken: string;
  /** Where to send the customer next: Stripe Checkout (external) or the local simulator. */
  next: { kind: "external"; url: string } | { kind: "internal"; path: string };
  mode: PaymentsMode;
};

export type CheckoutFailure =
  | { ok: false; error: "invalid"; fieldErrors: FieldErrors }
  | { ok: false; error: "not-payable"; issues: QuoteIssue[] }
  | { ok: false; error: "price-changed"; totalCents: number }
  | { ok: false; error: "age-confirmation-required" }
  | { ok: false; error: "payments-disabled" }
  | { ok: false; error: "rate-limited" }
  | { ok: false; error: "network" }
  | { ok: false; error: "server" };

export type CheckoutResult = CheckoutSuccess | CheckoutFailure;

export type OrderLookup =
  | { ok: true; order: OrderSummary }
  | { ok: false; error: "not-found" | "network" | "server" };

/** One interface, two implementations: the demo simulator and the order Worker API. */
export interface OrderGateway {
  readonly kind: "demo" | "api";
  getPaymentsMode(): Promise<PaymentsMode>;
  createCheckout(request: CheckoutRequest): Promise<CheckoutResult>;
  getOrder(orderId: string, orderToken: string): Promise<OrderLookup>;
}

/** Extra controls only the demo simulator offers (never available against the API). */
export interface DemoControls {
  simulatePayment(
    orderId: string,
    orderToken: string,
    outcome: "approve" | "decline" | "cancel",
  ): Promise<OrderLookup>;
  advanceDemoOrder(orderId: string, orderToken: string): Promise<OrderLookup>;
}

export const CHECKOUT_ERROR_COPY: Record<CheckoutFailure["error"], string> = {
  invalid: "Revisa los datos marcados.",
  "not-payable": "Hay productos en el pedido que no se pueden pagar online ahora mismo.",
  "price-changed": "Los precios han cambiado desde que abriste la carta. Revisa el total antes de continuar.",
  "age-confirmation-required": "El pedido incluye bebidas alcohólicas: confirma que eres mayor de 18 años.",
  "payments-disabled": "El pago online no está disponible en este momento. Puedes llamar al restaurante para hacer tu pedido.",
  "rate-limited": "Demasiados intentos seguidos. Espera un minuto y vuelve a intentarlo.",
  network: "No hay conexión con el servidor de pedidos. Comprueba tu conexión y vuelve a intentarlo.",
  server: "El servidor de pedidos no ha podido guardar el pedido. No se ha realizado ningún cargo. Inténtalo de nuevo en unos minutos.",
};

export const TERMINAL_STATUSES: readonly OrderStatus[] = ["completed", "cancelled"];
