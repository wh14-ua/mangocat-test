import { describe, expect, it } from "vitest";
import { describeOrder } from "@/lib/commerce/order-view";
import { isSettled, normalizeLegacyStatus } from "@/lib/commerce/orders";
import type { OrderSummary } from "@/lib/commerce/types";

const base: OrderSummary = {
  id: "SH-261105-ABCDEF",
  number: 1042,
  status: "pending",
  paymentStatus: "unpaid",
  createdAt: "2026-11-05T12:30:00.000Z",
  updatedAt: "2026-11-05T12:30:00.000Z",
  fulfillment: "pickup",
  lines: [],
  subtotalCents: 2540,
  deliveryFeeCents: 0,
  totalCents: 2540,
  currency: "EUR",
  customerName: "Pedro",
  mode: "stripe-test",
};

const order = (patch: Partial<OrderSummary>): OrderSummary => ({ ...base, ...patch });

describe("describeOrder", () => {
  it("never presents an authorisation as a charge", () => {
    const view = describeOrder(order({ status: "awaiting_acceptance", paymentStatus: "authorized" }), "es");
    expect(view.headline).toBe("Pendiente de aceptación");
    expect(view.payment.label).toBe("Pago autorizado");
    expect(view.payment.detail).toMatch(/todavía sin cobrar/);
    expect(view.steps?.map((s) => s.state)).toEqual(["done", "current", "todo", "todo", "todo"]);
    expect(view.eta).toBeNull();
    expect(view.settled).toBe(false);
  });

  it("shows the preparation time only when the restaurant set it", () => {
    const accepted = order({
      status: "preparing",
      paymentStatus: "captured",
      acceptedAt: "2026-11-05T12:45:00.000Z",
      prepMinutes: 20,
      readyBy: "2026-11-05T13:05:00.000Z",
    });
    expect(describeOrder(accepted, "es").eta).toMatchObject({ clock: "14:05", minutes: 20, text: "Listo hacia las 14:05 (unos 20 min)" });
    expect(describeOrder(accepted, "en").eta?.text).toBe("Ready around 14:05 (about 20 min)");
    expect(describeOrder(order({ status: "preparing", paymentStatus: "captured" }), "es").eta).toBeNull();
    expect(describeOrder(accepted, "es").steps?.map((s) => s.state)).toEqual(["done", "done", "current", "todo", "todo"]);
  });

  it("does not call a requested refund completed", () => {
    const pending = describeOrder(order({ status: "rejected", paymentStatus: "refund_pending", rejectionReason: "Sin existencias" }), "es");
    expect(pending.payment.label).toBe("Reembolso pendiente");
    expect(pending.rejectionReason).toBe("Sin existencias");
    expect(pending.steps).toBeNull();
    expect(pending.settled).toBe(false); // keeps polling until Stripe confirms
    const done = describeOrder(order({ status: "rejected", paymentStatus: "refunded" }), "en");
    expect(done.payment.label).toBe("Refund completed");
    expect(done.settled).toBe(true);
    expect(done.refreshMs).toBe(0);
  });

  it("explains a released authorisation on rejection", () => {
    const view = describeOrder(order({ status: "rejected", paymentStatus: "canceled" }), "es");
    expect(view.headline).toBe("Pedido rechazado");
    expect(view.payment.detail).toMatch(/no se te ha cobrado nada/);
    expect(view.tone).toBe("negative");
  });

  it("polls fast while waiting and stops when settled", () => {
    expect(describeOrder(order({}), "es").refreshMs).toBe(3000);
    expect(describeOrder(order({ status: "awaiting_acceptance", paymentStatus: "authorized" }), "es").refreshMs).toBe(5000);
    expect(describeOrder(order({ status: "completed", paymentStatus: "captured" }), "es").refreshMs).toBe(0);
    expect(describeOrder(order({ status: "failed", paymentStatus: "failed" }), "es").canRetryCheckout).toBe(true);
  });
});

describe("legacy orders", () => {
  it("maps the old paid status to awaiting acceptance with a captured payment", () => {
    expect(normalizeLegacyStatus("paid")).toEqual({ status: "awaiting_acceptance", paymentStatus: "captured" });
    expect(normalizeLegacyStatus("preparing")).toEqual({ status: "preparing", paymentStatus: "captured" });
    expect(normalizeLegacyStatus("pending")).toEqual({ status: "pending", paymentStatus: "unpaid" });
    expect(normalizeLegacyStatus("weird")).toEqual({ status: "needs_review", paymentStatus: "unpaid" });
    expect(isSettled({ status: "completed", paymentStatus: "captured" })).toBe(true);
  });
});
