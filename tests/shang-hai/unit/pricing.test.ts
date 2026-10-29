import { describe, expect, it } from "vitest";
import { quoteLines } from "@/lib/commerce/pricing";
import { formatCents, multiplyCents, sumCents } from "@/lib/commerce/money";
import { index, LIMITS, NO_DELIVERY } from "./fixtures";

const ctx = { fulfillment: "pickup" as const, delivery: NO_DELIVERY, limits: LIMITS };

describe("money", () => {
  it("multiplies and sums integer cents without float drift", () => {
    expect(multiplyCents(765, 3)).toBe(2295);
    expect(sumCents([1945, 945, 945])).toBe(3835);
    // 0.1 + 0.2 style problems cannot happen with cents
    expect(sumCents([10, 20])).toBe(30);
  });

  it("refuses fractional or negative inputs", () => {
    expect(() => multiplyCents(12.5, 2)).toThrow();
    expect(() => multiplyCents(100, 1.5)).toThrow();
    expect(() => multiplyCents(100, -1)).toThrow();
    expect(() => sumCents([100, -5])).toThrow();
  });

  it("formats euros the Spanish way", () => {
    expect(formatCents(1945).replace(/\s/g, " ")).toBe("19,45 €");
    expect(formatCents(8000).replace(/\s/g, " ")).toBe("80,00 €");
  });
});

describe("quoteLines", () => {
  it("multiplies quantities and adds subtotals into the total", () => {
    const q = quoteLines(
      index,
      [
        { itemId: "combo-a", quantity: 2 },
        { itemId: "maki-salmon", quantity: 3 },
      ],
      ctx,
    );
    expect(q.payable).toBe(true);
    expect(q.lines.map((l) => [l.itemId, l.unitPriceCents, l.lineTotalCents])).toEqual([
      ["combo-a", 1945, 3890],
      ["maki-salmon", 945, 2835],
    ]);
    expect(q.subtotalCents).toBe(6725);
    expect(q.deliveryFeeCents).toBe(0);
    expect(q.totalCents).toBe(6725);
    expect(q.itemCount).toBe(5);
  });

  it("merges repeated lines of the same configuration", () => {
    const q = quoteLines(
      index,
      [
        { itemId: "combo-a", quantity: 1 },
        { itemId: "combo-a", quantity: 2 },
      ],
      ctx,
    );
    expect(q.lines).toHaveLength(1);
    expect(q.lines[0].quantity).toBe(3);
    expect(q.totalCents).toBe(5835);
  });

  it("rejects unknown products", () => {
    const q = quoteLines(index, [{ itemId: "no-existe", quantity: 1 }], ctx);
    expect(q.payable).toBe(false);
    expect(q.issues).toContainEqual({ code: "unknown-item", itemId: "no-existe" });
    expect(q.totalCents).toBe(0);
  });

  it("never charges products with an unknown or conflicting price", () => {
    const q = quoteLines(
      index,
      [
        { itemId: "combo-a", quantity: 1 },
        { itemId: "sin-precio", quantity: 1 },
        { itemId: "en-conflicto", quantity: 1 },
      ],
      ctx,
    );
    expect(q.payable).toBe(false);
    expect(q.issues).toEqual(
      expect.arrayContaining([
        { code: "not-orderable", itemId: "sin-precio", reason: "price-pending" },
        { code: "not-orderable", itemId: "en-conflicto", reason: "price-conflict" },
      ]),
    );
    // The total only reflects confirmed prices.
    expect(q.totalCents).toBe(1945);
  });

  it("rejects unavailable products and hidden duplicates", () => {
    const q = quoteLines(
      index,
      [
        { itemId: "agotado", quantity: 1 },
        { itemId: "duplicado", quantity: 1 },
      ],
      ctx,
    );
    expect(q.issues.map((i) => ("reason" in i ? i.reason : i.code))).toEqual([
      "unavailable",
      "duplicate",
    ]);
  });

  it.each([0, -1, 1.5, 21, Number.NaN, Number.MAX_SAFE_INTEGER + 2])(
    "rejects invalid quantity %s",
    (quantity) => {
      const q = quoteLines(index, [{ itemId: "combo-a", quantity }], ctx);
      expect(q.payable).toBe(false);
      expect(q.issues[0]).toEqual({ code: "invalid-quantity", itemId: "combo-a" });
    },
  );

  it("prices real options, including paid extras, and enforces their rules", () => {
    const ok = quoteLines(
      index,
      [
        { itemId: "menu-6", quantity: 1, selections: { elige: ["con-cafe"] } },
        { itemId: "con-extra", quantity: 2, selections: { extra: ["queso", "salsa"] } },
      ],
      ctx,
    );
    expect(ok.payable).toBe(true);
    expect(ok.lines[0]).toMatchObject({ unitPriceCents: 8345, optionsLabel: "Con café" });
    expect(ok.lines[1]).toMatchObject({ unitPriceCents: 700, lineTotalCents: 1400 });

    const missing = quoteLines(index, [{ itemId: "menu-6", quantity: 1 }], ctx);
    expect(missing.issues).toContainEqual({ code: "invalid-options", itemId: "menu-6" });

    const invented = quoteLines(
      index,
      [{ itemId: "combo-a", quantity: 1, selections: { picante: ["mucho"] } }],
      ctx,
    );
    expect(invented.issues).toContainEqual({ code: "invalid-options", itemId: "combo-a" });

    const tooMany = quoteLines(
      index,
      [{ itemId: "menu-6", quantity: 1, selections: { elige: ["con-cafe", "con-postre"] } }],
      ctx,
    );
    expect(tooMany.payable).toBe(false);
  });

  it("enforces order-level limits", () => {
    const many = quoteLines(
      index,
      [
        { itemId: "combo-a", quantity: 20 },
        { itemId: "maki-salmon", quantity: 11 },
      ],
      ctx,
    );
    expect(many.issues).toContainEqual({ code: "too-many-items" });

    const expensive = quoteLines(index, [{ itemId: "menu-6", quantity: 7, selections: { elige: ["con-postre"] } }], ctx);
    expect(expensive.issues).toContainEqual({ code: "order-total-limit" });
  });

  it("refuses delivery while own delivery is not confirmed", () => {
    const q = quoteLines(index, [{ itemId: "combo-a", quantity: 1 }], {
      ...ctx,
      fulfillment: "delivery",
    });
    expect(q.payable).toBe(false);
    expect(q.issues).toContainEqual({ code: "delivery-unavailable" });
    expect(q.deliveryFeeCents).toBe(0);
  });

  it("applies only confirmed delivery rules (fee, minimum, free threshold)", () => {
    const delivery = { ...NO_DELIVERY, enabled: true, feeCents: 250, minimumOrderCents: 1500, freeDeliveryFromCents: 4000 };
    const small = quoteLines(index, [{ itemId: "maki-salmon", quantity: 1 }], { ...ctx, fulfillment: "delivery", delivery });
    expect(small.issues).toContainEqual({ code: "delivery-minimum", minimumCents: 1500 });
    const normal = quoteLines(index, [{ itemId: "combo-a", quantity: 1 }], { ...ctx, fulfillment: "delivery", delivery });
    expect(normal).toMatchObject({ payable: true, deliveryFeeCents: 250, totalCents: 2195 });
    const free = quoteLines(index, [{ itemId: "combo-a", quantity: 3 }], { ...ctx, fulfillment: "delivery", delivery });
    expect(free).toMatchObject({ payable: true, deliveryFeeCents: 0, totalCents: 5835 });
  });

  it("flags alcohol so checkout can ask for age confirmation", () => {
    const q = quoteLines(index, [{ itemId: "vino", quantity: 1 }], ctx);
    expect(q.containsAgeRestricted).toBe(true);
  });

  it("an empty order is not payable", () => {
    const q = quoteLines(index, [], ctx);
    expect(q.payable).toBe(false);
    expect(q.issues).toContainEqual({ code: "empty" });
  });
});
