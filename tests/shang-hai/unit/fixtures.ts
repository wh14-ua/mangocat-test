import { createCatalogIndex } from "@/lib/commerce/catalog";
import type { DeliveryConfig, MenuCatalog, MenuItem, OrderLimits } from "@/lib/commerce/types";

export const LIMITS: OrderLimits = {
  maxQuantityPerLine: 20,
  maxLines: 5,
  maxItemsPerOrder: 30,
  maxOrderTotalCents: 50_000,
  maxNotesLength: 300,
};

export const NO_DELIVERY: DeliveryConfig = {
  enabled: false,
  feeCents: null,
  minimumOrderCents: null,
  freeDeliveryFromCents: null,
  postalCodes: [],
  municipalities: [],
  prepTimeMinutes: null,
};

const base = (over: Partial<MenuItem> & Pick<MenuItem, "id" | "name">): MenuItem => ({
  categoryId: "cat",
  priceCents: 1000,
  available: true,
  source: "test",
  verificationStatus: "verified",
  ...over,
});

export function makeCatalog(extra: MenuItem[] = []): MenuCatalog {
  const items: MenuItem[] = [
    base({ id: "combo-a", name: "Combo A", priceCents: 1945 }),
    base({ id: "maki-salmon", name: "Maki Salmón", priceCents: 945 }),
    base({ id: "pato-a-la-pekinesa", name: "Pato a la Pekinesa", priceCents: 1400 }),
    base({ id: "sin-precio", name: "Plato sin precio", priceCents: null, verificationStatus: "pending" }),
    base({ id: "en-conflicto", name: "Cerveza", priceCents: 300, verificationStatus: "conflicting" }),
    base({ id: "agotado", name: "Plato agotado", available: false }),
    base({ id: "duplicado", name: "Combo A", duplicateOf: "combo-a" }),
    base({ id: "vino", name: "Vino de la casa", priceCents: 745, ageRestricted: true }),
    base({
      id: "menu-6",
      name: "Menú para 6",
      priceCents: 8345,
      options: [
        {
          id: "elige",
          name: "Elige",
          minChoices: 1,
          maxChoices: 1,
          choices: [
            { id: "con-postre", name: "Con postre", priceDeltaCents: 0 },
            { id: "con-cafe", name: "Con café", priceDeltaCents: 0 },
          ],
        },
      ],
    }),
    base({
      id: "con-extra",
      name: "Con extra",
      priceCents: 500,
      options: [
        {
          id: "extra",
          name: "Extra",
          minChoices: 0,
          maxChoices: 2,
          choices: [
            { id: "queso", name: "Queso", priceDeltaCents: 150 },
            { id: "salsa", name: "Salsa", priceDeltaCents: 50 },
          ],
        },
      ],
    }),
    ...extra,
  ];
  return {
    schemaVersion: 1,
    catalogId: "test-catalog",
    currency: "EUR",
    version: "test.1",
    generatedAt: "2026-10-29",
    sources: [],
    categories: [{ id: "cat", name: "Todo", itemIds: items.map((i) => i.id) }],
    items,
  };
}

export const index = createCatalogIndex(makeCatalog());
