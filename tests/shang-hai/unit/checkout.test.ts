import { describe, expect, it } from "vitest";
import { prepareOrder } from "@/lib/commerce/checkout/prepare-order";
import { createDemoGateway } from "@/lib/commerce/checkout/demo-gateway";
import { normalizePhone, validateCustomer } from "@/lib/commerce/validation";
import { canTransition } from "@/lib/commerce/orders";
import { isOpenAt } from "@/lib/commerce/hours";
import type { OrderingConfig } from "@/lib/commerce/types";
import { index, LIMITS, NO_DELIVERY } from "./fixtures";

const ordering: OrderingConfig = {
  currency: "EUR",
  timeZone: "Europe/Madrid",
  pickup: { enabled: true, prepTimeMinutes: null, allowRequestedTime: false, enforceOpeningHours: false },
  delivery: NO_DELIVERY,
  limits: LIMITS,
  hours: [
    { day: 2, ranges: [] },
    { day: 3, ranges: [{ from: "12:00", to: "16:00" }, { from: "19:30", to: "23:30" }] },
  ],
};
const ctx = { index, ordering, allowedStorefronts: ["ink-house", "bento-club"] };

const request = (over: Record<string, unknown> = {}) => ({
  catalogId: "test-catalog",
  storefront: "ink-house",
  fulfillment: "pickup",
  lines: [{ itemId: "combo-a", quantity: 2 }],
  customer: { name: "Lucía García", phone: "612 345 678", email: "Lucia@Example.es" },
  ...over,
});

describe("customer validation", () => {
  it("accepts and normalizes valid details", () => {
    const r = validateCustomer({ name: "  Lucía  García ", phone: "+34 612-345-678", email: "LUCIA@example.es", notes: "Sin cebolla" }, LIMITS);
    expect(r).toEqual({
      ok: true,
      value: { name: "Lucía García", phone: "+34612345678", email: "lucia@example.es", notes: "Sin cebolla" },
    });
  });

  it("explains what is wrong with each field", () => {
    const r = validateCustomer({ name: "L", phone: "123", email: "lucia@", notes: "x".repeat(301) }, LIMITS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["email", "name", "notes", "phone"]);
  });

  it("normalizes Spanish and international phones", () => {
    expect(normalizePhone("612345678")).toBe("+34612345678");
    expect(normalizePhone("0034 965 123 456")).toBe("+34965123456");
    expect(normalizePhone("+44 7911 123456")).toBe("+447911123456");
    expect(normalizePhone("12345")).toBeNull();
  });
});

describe("prepareOrder (server-side checkout rules)", () => {
  it("prices from the catalog, ignoring anything the browser claims", () => {
    const r = prepareOrder(
      request({ lines: [{ itemId: "combo-a", quantity: 2, unitPriceCents: 1, priceCents: 1 }], totalCents: 2 }),
      ctx,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.quote.totalCents).toBe(3890);
  });

  it("rejects a manipulated expected total", () => {
    const r = prepareOrder(request({ expectedTotalCents: 100 }), ctx);
    expect(r).toEqual({ ok: false, error: "price-changed", totalCents: 3890 });
  });

  it("accepts the right expected total", () => {
    expect(prepareOrder(request({ expectedTotalCents: 3890 }), ctx).ok).toBe(true);
  });

  it.each([
    [{ lines: [{ itemId: "combo-a", quantity: -1 }] }, "invalid"],
    [{ lines: [{ itemId: "combo-a", quantity: 2.5 }] }, "invalid"],
    [{ lines: [{ itemId: "combo-a", quantity: "2" }] }, "invalid"],
    [{ lines: [] }, "invalid"],
    [{ lines: [{ itemId: "<script>", quantity: 1 }] }, "invalid"],
    [{ storefront: "evil-shop" }, "invalid"],
    [{ catalogId: "other-catalog" }, "invalid"],
    [{ customer: { name: "", phone: "", email: "" } }, "invalid"],
    [{ lines: [{ itemId: "no-existe", quantity: 1 }] }, "not-payable"],
    [{ lines: [{ itemId: "sin-precio", quantity: 1 }] }, "not-payable"],
    [{ lines: [{ itemId: "agotado", quantity: 1 }] }, "not-payable"],
    [{ fulfillment: "delivery", delivery: { street: "Calle Mayor 1", postalCode: "03300", city: "Orihuela" } }, "not-payable"],
    [{ lines: [{ itemId: "vino", quantity: 1 }] }, "age-confirmation-required"],
  ])("rejects %j with %s", (over, error) => {
    const r = prepareOrder(request(over), ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(error);
  });

  it("accepts alcohol once the buyer confirms their age", () => {
    expect(prepareOrder(request({ lines: [{ itemId: "vino", quantity: 1 }], ageConfirmed: true }), ctx).ok).toBe(true);
  });

  it("rejects malformed bodies", () => {
    for (const body of [null, "x", 42, [], { lines: {} }]) {
      expect(prepareOrder(body, ctx)).toMatchObject({ ok: false, error: "invalid" });
    }
  });

  it("only enforces opening hours when the restaurant enables it", () => {
    const tuesday = new Date("2026-10-27T13:00:00+01:00");
    const enforced = { ...ctx, now: tuesday, ordering: { ...ordering, pickup: { ...ordering.pickup, enforceOpeningHours: true } } };
    expect(prepareOrder(request(), enforced).ok).toBe(false);
    expect(prepareOrder(request(), { ...ctx, now: tuesday }).ok).toBe(true);
  });
});

describe("order lifecycle", () => {
  it("allows only legitimate transitions", () => {
    expect(canTransition("pending", "paid")).toBe(true);
    expect(canTransition("paid", "preparing")).toBe(true);
    expect(canTransition("preparing", "ready")).toBe(true);
    expect(canTransition("ready", "completed")).toBe(true);
    expect(canTransition("pending", "completed")).toBe(false);
    expect(canTransition("completed", "pending")).toBe(false);
    expect(canTransition("cancelled", "paid")).toBe(false);
  });

  it("knows the opening hours in the restaurant's time zone", () => {
    expect(isOpenAt(ordering.hours, new Date("2026-10-28T13:00:00+01:00"), "Europe/Madrid")).toBe(true);
    expect(isOpenAt(ordering.hours, new Date("2026-10-28T17:00:00+01:00"), "Europe/Madrid")).toBe(false);
    expect(isOpenAt(ordering.hours, new Date("2026-10-27T13:00:00+01:00"), "Europe/Madrid")).toBe(false);
  });
});

describe("demo gateway", () => {
  function memoryStorage(): Storage {
    const m = new Map<string, string>();
    return {
      get length() {
        return m.size;
      },
      clear: () => m.clear(),
      getItem: (k) => m.get(k) ?? null,
      key: (i) => [...m.keys()][i] ?? null,
      removeItem: (k) => void m.delete(k),
      setItem: (k, v) => void m.set(k, String(v)),
    };
  }

  it("runs the full simulated flow without charging anything", async () => {
    const storage = memoryStorage();
    const gw = createDemoGateway({
      storageKey: "demo",
      prepare: ctx,
      paymentPath: (id, t, s) => `/pago-demo/?pedido=${id}&t=${t}&tienda=${s}`,
      storage,
      latencyMs: 0,
    });
    expect(await gw.getPaymentsMode()).toBe("demo");
    const created = await gw.createCheckout(request() as never);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.orderId).toMatch(/^DEMO-[A-Z2-9]{6}$/);
    expect(created.next).toEqual({ kind: "internal", path: expect.stringContaining("/pago-demo/") });

    const pending = await gw.getOrder(created.orderId, created.orderToken);
    expect(pending).toMatchObject({ ok: true, order: { status: "pending", totalCents: 3890, mode: "demo" } });
    expect(await gw.getOrder(created.orderId, "wrong-token")).toEqual({ ok: false, error: "not-found" });

    const paid = await gw.simulatePayment(created.orderId, created.orderToken, "approve");
    expect(paid).toMatchObject({ ok: true, order: { status: "paid" } });
    for (const expected of ["preparing", "ready", "completed", "completed"]) {
      const next = await gw.advanceDemoOrder(created.orderId, created.orderToken);
      expect(next).toMatchObject({ ok: true, order: { status: expected } });
    }
  });

  it("returns the same validation errors as the server", async () => {
    const gw = createDemoGateway({ storageKey: "demo", prepare: ctx, paymentPath: () => "/", storage: memoryStorage(), latencyMs: 0 });
    expect(await gw.createCheckout(request({ expectedTotalCents: 1 }) as never)).toMatchObject({ ok: false, error: "price-changed" });
    const declined = await gw.createCheckout(request() as never);
    if (!declined.ok) throw new Error("expected ok");
    expect(await gw.simulatePayment(declined.orderId, declined.orderToken, "decline")).toMatchObject({ order: { status: "failed" } });
  });
});
