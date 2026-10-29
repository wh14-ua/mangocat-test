import { describe, expect, it } from "vitest";
import {
  addToCart,
  decrementLine,
  EMPTY_CART,
  incrementLine,
  lineKey,
  quantityOfItem,
  removeLine,
  setLineQuantity,
} from "@/lib/commerce/cart";
import { restoreCart, serializeCart } from "@/lib/commerce/persistence";
import { createCatalogIndex } from "@/lib/commerce/catalog";
import type { CartState } from "@/lib/commerce/types";
import { index, LIMITS, makeCatalog } from "./fixtures";

function add(state: CartState, itemId: string, qty = 1, selections?: Record<string, string[]>) {
  const r = addToCart(state, index, LIMITS, itemId, selections, qty);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

describe("cart operations", () => {
  it("adds, increments, decrements and removes", () => {
    let s = add(EMPTY_CART, "combo-a");
    s = add(s, "maki-salmon", 2);
    s = add(s, "combo-a"); // merges
    expect(s.lines.map((l) => [l.itemId, l.quantity])).toEqual([
      ["combo-a", 2],
      ["maki-salmon", 2],
    ]);
    s = incrementLine(s, LIMITS, "maki-salmon");
    expect(quantityOfItem(s, "maki-salmon")).toBe(3);
    s = decrementLine(s, LIMITS, "combo-a");
    s = decrementLine(s, LIMITS, "combo-a"); // reaches 0 -> removed
    expect(s.lines.map((l) => l.itemId)).toEqual(["maki-salmon"]);
    s = removeLine(s, "maki-salmon");
    expect(s.lines).toEqual([]);
  });

  it("keeps different option choices on separate lines", () => {
    let s = add(EMPTY_CART, "menu-6", 1, { elige: ["con-postre"] });
    s = add(s, "menu-6", 1, { elige: ["con-cafe"] });
    expect(s.lines).toHaveLength(2);
    expect(s.lines[0].key).toBe(lineKey("menu-6", { elige: ["con-postre"] }));
    expect(quantityOfItem(s, "menu-6")).toBe(2);
  });

  it("refuses non-orderable items and invalid options", () => {
    for (const id of ["sin-precio", "en-conflicto", "agotado", "duplicado"]) {
      expect(addToCart(EMPTY_CART, index, LIMITS, id).ok).toBe(false);
    }
    expect(addToCart(EMPTY_CART, index, LIMITS, "no-existe")).toMatchObject({ ok: false, error: "unknown-item" });
    expect(addToCart(EMPTY_CART, index, LIMITS, "menu-6")).toMatchObject({ ok: false, error: "invalid-options" });
  });

  it("never allows negative, fractional or absurd quantities", () => {
    expect(addToCart(EMPTY_CART, index, LIMITS, "combo-a", undefined, -2).ok).toBe(false);
    expect(addToCart(EMPTY_CART, index, LIMITS, "combo-a", undefined, 1.5).ok).toBe(false);
    expect(addToCart(EMPTY_CART, index, LIMITS, "combo-a", undefined, 21)).toMatchObject({ error: "quantity-limit" });
    let s = add(EMPTY_CART, "combo-a", 3);
    s = setLineQuantity(s, LIMITS, "combo-a", 999);
    expect(s.lines[0].quantity).toBe(20);
    s = setLineQuantity(s, LIMITS, "combo-a", 2.7);
    expect(s.lines[0].quantity).toBe(2);
    s = setLineQuantity(s, LIMITS, "combo-a", -4);
    expect(s.lines).toEqual([]);
  });

  it("enforces line and order limits", () => {
    let s = EMPTY_CART;
    for (const id of ["combo-a", "maki-salmon", "pato-a-la-pekinesa", "vino"]) s = add(s, id);
    s = add(s, "con-extra");
    expect(addToCart(s, index, LIMITS, "menu-6", { elige: ["con-cafe"] })).toMatchObject({ error: "line-limit" });
    let big = add(EMPTY_CART, "combo-a", 20);
    big = add(big, "maki-salmon", 10);
    expect(addToCart(big, index, LIMITS, "vino")).toMatchObject({ error: "order-limit" });
  });
});

describe("cart persistence", () => {
  const now = new Date("2026-10-29T12:00:00Z");

  it("round-trips ids and quantities but never prices", () => {
    let s = add(EMPTY_CART, "combo-a", 2);
    s = add(s, "menu-6", 1, { elige: ["con-cafe"] });
    const raw = serializeCart(s, "test-catalog", now);
    expect(raw).not.toContain("1945");
    expect(raw).not.toMatch(/price/i);
    const restored = restoreCart(raw, index, LIMITS, 14, now);
    expect(restored.dropped).toEqual([]);
    expect(restored.state).toEqual(s);
  });

  it("re-validates against the current catalog when it changes", () => {
    const s = add(add(EMPTY_CART, "combo-a"), "maki-salmon", 2);
    const raw = serializeCart(s, "test-catalog", now);
    const changed = makeCatalog();
    changed.items = changed.items.map((i) =>
      i.id === "maki-salmon" ? { ...i, available: false } : i.id === "combo-a" ? { ...i, priceCents: 2045 } : i,
    );
    const restored = restoreCart(raw, createCatalogIndex(changed), LIMITS, 14, now);
    expect(restored.state.lines.map((l) => l.itemId)).toEqual(["combo-a"]);
    expect(restored.dropped).toEqual(["Maki Salmón"]);
  });

  it("discards tampered, foreign, outdated or expired payloads", () => {
    const valid = JSON.parse(serializeCart(add(EMPTY_CART, "combo-a"), "test-catalog", now));
    const cases = [
      "not json",
      JSON.stringify({ ...valid, v: 0 }),
      JSON.stringify({ ...valid, catalogId: "other" }),
      JSON.stringify({ ...valid, lines: "x" }),
      JSON.stringify({ ...valid, savedAt: "2026-09-01T00:00:00Z" }),
    ];
    for (const raw of cases) expect(restoreCart(raw, index, LIMITS, 14, now).state.lines).toEqual([]);
  });

  it("drops lines with bad quantities or unknown ids instead of trusting them", () => {
    const raw = JSON.stringify({
      v: 1,
      catalogId: "test-catalog",
      savedAt: now.toISOString(),
      lines: [
        { itemId: "combo-a", quantity: 9999 },
        { itemId: "maki-salmon", quantity: -3 },
        { itemId: "inventado", quantity: 1 },
        { itemId: "sin-precio", quantity: 1, priceCents: 1 },
      ],
    });
    const restored = restoreCart(raw, index, LIMITS, 14, now);
    expect(restored.state.lines).toEqual([
      { key: "combo-a", itemId: "combo-a", quantity: 20, selections: {} },
    ]);
    expect(restored.dropped).toHaveLength(3);
  });
});
