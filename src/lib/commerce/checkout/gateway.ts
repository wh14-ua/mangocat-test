import type { CheckoutRequest, OrderStatus, OrderSummary } from "../types";
import type { FieldErrors } from "../validation";
import type { QuoteIssue } from "../pricing";
import { CHECKOUT_ERROR_TEXT } from "../messages";

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

/** What the simulated restaurant can do with a demo order (mirrors the real staff panel). */
export type DemoRestaurantAction =
  | { type: "accept"; prepMinutes: number }
  | { type: "reject"; reason?: string }
  | { type: "ready" }
  | { type: "complete" };

/** Extra controls only the demo simulator offers (never available against the API). */
export interface DemoControls {
  simulatePayment(
    orderId: string,
    orderToken: string,
    outcome: "approve" | "decline" | "cancel",
  ): Promise<OrderLookup>;
  simulateRestaurant(orderId: string, orderToken: string, action: DemoRestaurantAction): Promise<OrderLookup>;
}

/** Spanish wording, kept for existing imports. Localized: CHECKOUT_ERROR_TEXT in messages.ts. */
export const CHECKOUT_ERROR_COPY: Record<CheckoutFailure["error"], string> = CHECKOUT_ERROR_TEXT.es;

export const TERMINAL_STATUSES: readonly OrderStatus[] = ["completed", "cancelled", "rejected"];
