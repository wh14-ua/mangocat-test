import { describe, expect, it } from "vitest";
import menu from "@/data/shang-hai/menu.json";
import { shangHaiRestaurant } from "@/data/shang-hai/restaurant";
import { getOrderability } from "@/lib/commerce/catalog";
import { quoteLines } from "@/lib/commerce/pricing";
import type { MenuCatalog } from "@/lib/commerce/types";
import { MENU_SECTIONS, shangHaiCatalog } from "@/lib/shang-hai/catalog";

const catalog = menu as MenuCatalog;

describe("Shang Hai catalog integrity", () => {
  it("has the 24 published categories and 209 entries", () => {
    expect(catalog.categories).toHaveLength(24);
    expect(catalog.items).toHaveLength(209);
  });

  it("uses unique, url-safe, stable ids", () => {
    const ids = catalog.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9][a-z0-9-]*$/);
    const sourceIds = catalog.items.map((i) => i.sourceId);
    expect(new Set(sourceIds).size).toBe(sourceIds.length);
  });

  it("references only existing items and each item belongs to its category", () => {
    for (const cat of catalog.categories) {
      for (const id of cat.itemIds) {
        const item = shangHaiCatalog.byId.get(id);
        expect(item, id).toBeDefined();
        expect(item?.categoryId).toBe(cat.id);
      }
    }
    const referenced = catalog.categories.flatMap((c) => c.itemIds);
    expect(referenced.length).toBe(catalog.items.length);
  });

  it("stores prices as integer cents or null, never floats", () => {
    for (const item of catalog.items) {
      if (item.priceCents !== null) {
        expect(Number.isSafeInteger(item.priceCents), item.id).toBe(true);
        expect(item.priceCents).toBeGreaterThan(0);
      }
      for (const o of item.options ?? []) for (const c of o.choices) expect(Number.isSafeInteger(c.priceDeltaCents)).toBe(true);
    }
  });

  it("matches the reference prices given in the brief", () => {
    const price = (name: string) => catalog.items.find((i) => i.name === name)?.priceCents;
    expect(price("Combo A")).toBe(1945);
    expect(price("Combo B")).toBe(3345);
    expect(price("Combo C")).toBe(4645);
    expect(price("Combo D")).toBe(6345);
    expect(price("Menú para 2 Personas A")).toBe(2745);
    expect(price("Menú para 2 Personas B")).toBe(3445);
  });

  it("keeps conflicting prices visible but not orderable", () => {
    const conflicting = catalog.items.filter((i) => i.verificationStatus === "conflicting");
    expect(conflicting.map((i) => i.id).sort()).toEqual(["cerveza-china", "cerveza-china-2", "sashimi-atun", "sashimi-de-atun"]);
    for (const item of conflicting) expect(getOrderability(item).orderable).toBe(false);
  });

  it("hides exact duplicates from the menu", () => {
    const visibleIds = shangHaiCatalog.visibleItems.map((i) => i.id);
    expect(visibleIds).not.toContain("frito-gambas-con-atun-2");
    expect(visibleIds).toContain("frito-gambas-con-atun");
    expect(shangHaiCatalog.visibleItems).toHaveLength(208);
  });

  it("only real options are modelled (the 6-person set menus)", () => {
    const withOptions = catalog.items.filter((i) => i.options?.length).map((i) => i.id);
    expect(withOptions.sort()).toEqual(["menu-para-6-personas-a", "menu-para-6-personas-b"]);
  });

  it("does not invent allergens or images", () => {
    for (const item of catalog.items) {
      expect(item.allergens).toBeUndefined();
      expect(item.image).toBeUndefined();
    }
  });

  it("groups every category into exactly one navigation section", () => {
    const grouped = MENU_SECTIONS.flatMap((s) => [...s.categoryIds]);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(grouped.sort()).toEqual(catalog.categories.map((c) => c.id).sort());
  });

  it("finds dishes regardless of accents and case", () => {
    expect(shangHaiCatalog.search("pato pekin").map((i) => i.id)).toContain("pato-a-la-pekinesa");
    expect(shangHaiCatalog.search("SALMON")[0].name).toMatch(/salmón/i);
    expect(shangHaiCatalog.search("gyoza").map((i) => i.id)).toContain("gyozas-de-pollo-a-la-plancha");
    expect(shangHaiCatalog.search("zzzz")).toEqual([]);
  });

  it("prices a typical order with the real catalog", () => {
    const q = quoteLines(
      shangHaiCatalog,
      [
        { itemId: "combo-a", quantity: 1 },
        { itemId: "pollo-con-almendras", quantity: 2 },
        { itemId: "arroz-frito-con-tres-delicias", quantity: 1 },
      ],
      {
        fulfillment: "pickup",
        delivery: shangHaiRestaurant.ordering.delivery,
        limits: shangHaiRestaurant.ordering.limits,
      },
    );
    expect(q.payable).toBe(true);
    expect(q.totalCents).toBe(1945 + 2 * 765 + 450);
  });

  it("keeps own delivery disabled until the owner confirms its conditions", () => {
    const d = shangHaiRestaurant.ordering.delivery;
    expect(d.enabled).toBe(false);
    expect(d.feeCents).toBeNull();
    expect(d.minimumOrderCents).toBeNull();
    expect(shangHaiRestaurant.ordering.pickup.prepTimeMinutes).toBeNull();
  });
});
