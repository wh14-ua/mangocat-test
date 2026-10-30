import type { CartState, OrderLimits } from "./types";
import { addToCart, EMPTY_CART } from "./cart";
import type { CatalogIndex } from "./catalog";

/** Bump when the stored shape changes; older payloads are discarded, never trusted. */
export const CART_STORAGE_VERSION = 1;

type StoredCart = {
  v: number;
  catalogId: string;
  savedAt: string;
  lines: { itemId: string; quantity: number; selections?: Record<string, string[]> }[];
};

export type RestoredCart = {
  state: CartState;
  /** Names (or ids) of lines that could not be restored. */
  dropped: string[];
};

export function serializeCart(state: CartState, catalogId: string, now = new Date()): string {
  const payload: StoredCart = {
    v: CART_STORAGE_VERSION,
    catalogId,
    savedAt: now.toISOString(),
    // Only ids, quantities and selections are stored. Prices are always recomputed.
    lines: state.lines.map((l) => ({
      itemId: l.itemId,
      quantity: l.quantity,
      ...(Object.keys(l.selections).length ? { selections: l.selections } : {}),
    })),
  };
  return JSON.stringify(payload);
}

/**
 * Restores a stored cart against the CURRENT catalog. Every line is re-validated
 * through addToCart (existence, orderability, options, limits); anything that no
 * longer fits is dropped and reported. Malformed payloads yield an empty cart.
 */
export function restoreCart(
  raw: string | null | undefined,
  index: CatalogIndex,
  limits: OrderLimits,
  maxAgeDays = 14,
  now = new Date(),
): RestoredCart {
  if (!raw) return { state: EMPTY_CART, dropped: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { state: EMPTY_CART, dropped: [] };
  }
  const data = parsed as Partial<StoredCart>;
  if (
    !data ||
    typeof data !== "object" ||
    data.v !== CART_STORAGE_VERSION ||
    data.catalogId !== index.catalog.catalogId ||
    !Array.isArray(data.lines)
  ) {
    return { state: EMPTY_CART, dropped: [] };
  }
  const savedAt = Date.parse(String(data.savedAt));
  if (!Number.isFinite(savedAt) || now.getTime() - savedAt > maxAgeDays * 86_400_000) {
    return { state: EMPTY_CART, dropped: [] };
  }

  let state: CartState = EMPTY_CART;
  const dropped: string[] = [];
  for (const line of data.lines.slice(0, limits.maxLines * 2)) {
    const itemId = typeof line?.itemId === "string" ? line.itemId : "";
    const quantity =
      typeof line?.quantity === "number" && Number.isSafeInteger(line.quantity)
        ? Math.min(line.quantity, limits.maxQuantityPerLine)
        : 0;
    const name = index.byId.get(itemId)?.name ?? itemId;
    if (quantity < 1) {
      dropped.push(name);
      continue;
    }
    const result = addToCart(state, index, limits, itemId, line.selections, quantity);
    if (result.ok) state = result.state;
    else dropped.push(name);
  }
  return { state, dropped: dropped.filter(Boolean) };
}
