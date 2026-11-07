import { describe, expect, it } from "vitest";
import type { OrderStatus } from "../../../src/lib/commerce/types";
import { derivePaymentStatus, factsFromIntent, planFromPayment, summarizeRefunds, type OrderPaymentState } from "../src/payments";
import type { StripePaymentIntent, StripeRefund } from "../src/stripe";

/**
 * The reconciliation decision table: for every order status and every situation Stripe can
 * report, what the order becomes. Webhooks, the cron and REINTENTAR all go through this one
 * pure function, so this table IS the policy (and documents it).
 */

const TOTAL = 4645;

function pi(over: Partial<StripePaymentIntent> & { refunded?: number } = {}): StripePaymentIntent {
  const { refunded = 0, ...rest } = over;
  return {
    id: "pi_test_1",
    status: "requires_capture",
    amount: TOTAL,
    amount_capturable: TOTAL,
    amount_received: 0,
    currency: "eur",
    livemode: false,
    metadata: { order_id: "SH-261106-AAAAAA" },
    cancellation_reason: null,
    last_payment_error: null,
    latest_charge: { id: "ch_1", amount_refunded: refunded, captured: false, payment_method_details: { type: "card", card: { capture_before: 1_800_000_000 } } },
    ...rest,
  };
}

const charged = (over: Partial<StripePaymentIntent> = {}) => pi({ status: "succeeded", amount_capturable: 0, amount_received: TOTAL, ...over });
const refund = (status: StripeRefund["status"], amount = TOTAL, extra: Partial<StripeRefund> = {}): StripeRefund => ({ id: `re_${status}`, status, amount, payment_intent: "pi_test_1", ...extra });

function order(status: OrderStatus, payment: OrderPaymentState["payment_status"] = "authorized"): OrderPaymentState {
  return { id: "SH-261106-AAAAAA", status, payment_status: payment, total_cents: TOTAL, payments_mode: "stripe-test" };
}

type Row = [label: string, status: OrderStatus, intent: StripePaymentIntent, refunds: StripeRefund[], expected: { to: OrderStatus | null; payment: string; review?: RegExp; notify?: boolean }];

const TABLE: Row[] = [
  // Payment being placed
  ["pending + hold placed", "pending", pi(), [], { to: "awaiting_acceptance", payment: "authorized", notify: true }],
  ["pending + charged at once", "pending", charged(), [], { to: "awaiting_acceptance", payment: "captured", notify: true }],
  ["pending + card declined", "pending", pi({ status: "requires_payment_method", amount_capturable: 0, last_payment_error: { code: "card_declined" } }), [], { to: "failed", payment: "failed" }],
  ["pending + not paid yet", "pending", pi({ status: "requires_payment_method", amount_capturable: 0 }), [], { to: null, payment: "unpaid" }],
  ["pending + 3-D Secure in progress", "pending", pi({ status: "requires_action", amount_capturable: 0 }), [], { to: null, payment: "unpaid" }],
  ["pending + processing", "pending", pi({ status: "processing", amount_capturable: 0 }), [], { to: null, payment: "processing" }],
  ["pending + cancelled at Stripe", "pending", pi({ status: "canceled", amount_capturable: 0 }), [], { to: "cancelled", payment: "canceled" }],
  ["pending + refunded before reaching us", "pending", charged({ latest_charge: { amount_refunded: TOTAL } }), [refund("succeeded")], { to: "needs_review", payment: "refunded", review: /sin pagar/ }],
  ["pending + amount differs", "pending", pi({ amount: TOTAL - 100 }), [], { to: "needs_review", payment: "authorized", review: /Importe/ }],
  ["pending + other currency", "pending", pi({ currency: "usd" }), [], { to: "needs_review", payment: "authorized", review: /Moneda/ }],
  ["pending + live payment for a test order", "pending", pi({ livemode: true }), [], { to: "needs_review", payment: "authorized", review: /modo/ }],
  ["pending + payment of another order", "pending", pi({ metadata: { order_id: "SH-261106-OTHER1" } }), [], { to: "needs_review", payment: "authorized", review: /otro pedido/ }],
  ["failed + declined again", "failed", pi({ status: "requires_payment_method", amount_capturable: 0, last_payment_error: { code: "card_declined" } }), [], { to: null, payment: "failed" }],
  ["failed + new attempt authorised", "failed", pi(), [], { to: "awaiting_acceptance", payment: "authorized", notify: true }],
  // Waiting for the restaurant
  ["awaiting + hold still there", "awaiting_acceptance", pi(), [], { to: null, payment: "authorized" }],
  ["awaiting + hold expired", "awaiting_acceptance", pi({ status: "canceled", amount_capturable: 0, cancellation_reason: "expired" }), [], { to: "cancelled", payment: "canceled" }],
  ["awaiting + refunded from the Dashboard", "awaiting_acceptance", charged(), [refund("pending")], { to: "needs_review", payment: "refund_pending", review: /sin rechazar/ }],
  ["awaiting + unexpected state", "awaiting_acceptance", pi({ status: "processing", amount_capturable: 0 }), [], { to: "needs_review", payment: "processing", review: /inesperado/ }],
  ["awaiting + amount differs", "awaiting_acceptance", pi({ amount: 1 }), [], { to: "needs_review", payment: "authorized", review: /Importe/ }],
  // A staff action holds the lock: only the payment column moves
  ["accepting + captured meanwhile", "accepting", charged(), [], { to: null, payment: "captured" }],
  ["rejecting + cancelled meanwhile", "rejecting", pi({ status: "canceled", amount_capturable: 0 }), [], { to: null, payment: "canceled" }],
  // In the kitchen
  ["preparing + charged", "preparing", charged(), [], { to: null, payment: "captured" }],
  ["preparing + refunded from the Dashboard", "preparing", charged(), [refund("succeeded")], { to: "needs_review", payment: "refunded", review: /en curso/ }],
  ["ready + hold never captured", "ready", pi(), [], { to: "needs_review", payment: "authorized", review: /inesperado/ }],
  ["preparing + reviewed amount mismatch", "preparing", charged({ amount: TOTAL - 100, amount_received: TOTAL - 100 }), [], { to: null, payment: "captured" }],
  ["completed + refunded later", "completed", charged(), [refund("succeeded")], { to: null, payment: "refunded" }],
  ["completed + charged", "completed", charged(), [], { to: null, payment: "captured" }],
  // Declined
  ["rejected + hold released", "rejected", pi({ status: "canceled", amount_capturable: 0 }), [], { to: null, payment: "canceled" }],
  ["rejected + refund confirmed", "rejected", charged(), [refund("succeeded")], { to: null, payment: "refunded" }],
  ["rejected + refund pending", "rejected", charged(), [refund("pending")], { to: null, payment: "refund_pending" }],
  ["rejected + refund failed", "rejected", charged(), [refund("failed", TOTAL, { failure_reason: "expired_or_canceled_card" })], { to: "needs_review", payment: "refund_failed", review: /expired_or_canceled_card/ }],
  ["rejected + hold still on the card", "rejected", pi(), [], { to: "needs_review", payment: "authorized", review: /sigue autorizado/ }],
  ["rejected + still charged", "rejected", charged(), [], { to: "needs_review", payment: "captured", review: /sigue cobrado/ }],
  ["cancelled + payment arrived anyway", "cancelled", pi(), [], { to: "needs_review", payment: "authorized", review: /ya cancelado/ }],
  ["cancelled + nothing", "cancelled", pi({ status: "canceled", amount_capturable: 0 }), [], { to: null, payment: "canceled" }],
  // A person is on it: never moved automatically
  ["needs_review + anything", "needs_review", charged(), [refund("succeeded")], { to: null, payment: "refunded" }],
];

describe("reconciliation decision table (planFromPayment)", () => {
  it.each(TABLE)("%s", (_label, status, intent, refunds, expected) => {
    const plan = planFromPayment(order(status), factsFromIntent(intent, refunds));
    expect(plan.to).toBe(expected.to);
    expect(plan.paymentStatus).toBe(expected.payment);
    if (expected.review) expect(plan.reviewReason).toMatch(expected.review);
    else expect(plan.reviewReason).toBeNull();
    expect(plan.notifyNewOrder).toBe(Boolean(expected.notify));
  });
});

describe("what a set of refunds means (summarizeRefunds / derivePaymentStatus)", () => {
  const status = (refunds: StripeRefund[], intent = charged()) => derivePaymentStatus(factsFromIntent(intent, refunds));
  it("succeeded only when every live refund succeeded and together they cover the charge", () => {
    expect(status([refund("succeeded")])).toBe("refunded");
    expect(status([refund("succeeded", 2000), refund("succeeded", 2645)])).toBe("refunded");
    expect(status([refund("succeeded", 2000), refund("pending", 2645)])).toBe("refund_pending");
  });
  it("a partial refund (e.g. from the Dashboard) leaves the payment charged", () => {
    expect(status([refund("succeeded", 1000)])).toBe("captured");
    expect(summarizeRefunds([refund("succeeded", 1000)], TOTAL)).toMatchObject({ partial: true, amount: 1000 });
  });
  it("failed refunds alone mean the money is still charged and the refund failed", () => {
    expect(status([refund("failed")])).toBe("refund_failed");
    expect(status([refund("canceled")])).toBe("refund_failed");
    // A newer refund that succeeded overrides an older failure.
    expect(status([refund("succeeded"), refund("failed")])).toBe("refunded");
  });
  it("a charge marked refunded with no refund to confirm it is never shown as refunded", () => {
    expect(derivePaymentStatus(factsFromIntent(charged({ latest_charge: { amount_refunded: TOTAL } }), []))).toBe("refund_pending");
  });
  it("no refunds, no summary", () => {
    expect(summarizeRefunds([], TOTAL)).toBeNull();
  });
});
