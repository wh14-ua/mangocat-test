import type { MenuCatalog, MenuCategory, MenuItem } from "./types";
import { normalizeText, tokenize } from "./text";
import { NOT_ORDERABLE_TEXT } from "./messages";

export type NotOrderableReason =
  | "unavailable"
  | "price-pending"
  | "price-conflict"
  | "duplicate";

export type Orderability =
  | { orderable: true }
  | { orderable: false; reason: NotOrderableReason };

/**
 * The single rule that decides whether a product can be added to an order and charged.
 * Shared by the storefronts and the Worker, so the UI can never offer something the
 * server would refuse.
 */
export function getOrderability(item: MenuItem): Orderability {
  if (item.duplicateOf) return { orderable: false, reason: "duplicate" };
  if (!item.available) return { orderable: false, reason: "unavailable" };
  if (item.priceCents === null) return { orderable: false, reason: "price-pending" };
  if (item.verificationStatus === "conflicting") {
    return { orderable: false, reason: "price-conflict" };
  }
  if (item.verificationStatus !== "verified") {
    return { orderable: false, reason: "price-pending" };
  }
  return { orderable: true };
}

/** Spanish wording, kept for existing imports. Localized: NOT_ORDERABLE_TEXT in messages.ts. */
export const NOT_ORDERABLE_COPY: Record<NotOrderableReason, string> = NOT_ORDERABLE_TEXT.es;

export type CatalogIndex = {
  catalog: MenuCatalog;
  byId: Map<string, MenuItem>;
  categoryById: Map<string, MenuCategory>;
  /** Categories in menu order with their visible (non-duplicate) items. */
  sections: { category: MenuCategory; items: MenuItem[] }[];
  visibleItems: MenuItem[];
  search: (query: string, limit?: number) => MenuItem[];
};

type SearchEntry = { item: MenuItem; names: string[]; haystack: string };

export type CatalogIndexOptions = {
  /** Extra searchable text per item, e.g. names and descriptions in other languages. */
  searchText?: (item: MenuItem, category: MenuCategory | undefined) => (string | undefined)[];
  /** Extra names that count as the item's name for ranking (prefix matches score higher). */
  searchNames?: (item: MenuItem) => (string | undefined)[];
};

export function createCatalogIndex(catalog: MenuCatalog, options: CatalogIndexOptions = {}): CatalogIndex {
  const byId = new Map(catalog.items.map((i) => [i.id, i]));
  const categoryById = new Map(catalog.categories.map((c) => [c.id, c]));
  const sections = catalog.categories.map((category) => ({
    category,
    items: category.itemIds
      .map((id) => byId.get(id))
      .filter((i): i is MenuItem => Boolean(i && !i.duplicateOf)),
  }));
  const visibleItems = sections.flatMap((s) => s.items);

  const entries: SearchEntry[] = visibleItems.map((item) => {
    const category = categoryById.get(item.categoryId);
    const rawNames = [item.name, item.nameEn, ...(options.searchNames?.(item) ?? [])].filter(
      (n): n is string => Boolean(n),
    );
    return {
      item,
      names: [...new Set(rawNames.map(normalizeText))],
      haystack: normalizeText(
        [
          ...rawNames,
          item.description,
          item.descriptionEn,
          category?.name,
          category?.nameEn,
          ...(options.searchText?.(item, category) ?? []),
        ]
          .filter(Boolean)
          .join(" "),
      ),
    };
  });

  function search(query: string, limit = 60): MenuItem[] {
    const tokens = tokenize(query);
    if (tokens.length === 0) return [];
    const scored: { item: MenuItem; score: number; order: number }[] = [];
    entries.forEach((entry, order) => {
      const words = entry.haystack.split(" ");
      let score = 0;
      for (const token of tokens) {
        if (!entry.haystack.includes(token)) return; // every token must match
        if (entry.names.some((n) => n.startsWith(token))) score += 6;
        else if (entry.names.some((n) => n.split(" ").some((w) => w.startsWith(token)))) score += 4;
        else if (words.some((w) => w.startsWith(token))) score += 2;
        else score += 1;
      }
      scored.push({ item: entry.item, score, order });
    });
    return scored
      .sort((a, b) => b.score - a.score || a.order - b.order)
      .slice(0, limit)
      .map((s) => s.item);
  }

  return { catalog, byId, categoryById, sections, visibleItems, search };
}

/** "Maki Salmón" + 8 piezas -> "Maki Salmón (8 piezas)" for receipts and payment pages. */
export function itemFullName(item: MenuItem): string {
  return item.pieces ? `${item.name} (${item.pieces.count} ${item.pieces.unit})` : item.name;
}
