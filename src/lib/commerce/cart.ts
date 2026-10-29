import type { CartLine, CartState, MenuItem, OptionSelections, OrderLimits } from "./types";
import { getOrderability, type CatalogIndex, type NotOrderableReason } from "./catalog";

export const EMPTY_CART: CartState = { lines: [] };

export type SelectionResult =
  | { ok: true; selections: OptionSelections }
  | { ok: false; error: "unknown-option" | "unknown-choice" | "too-few" | "too-many" };

/**
 * Validates and normalizes option selections against the item's real options:
 * unknown options/choices are rejected, choice ids are de-duplicated and sorted, and
 * min/max choice counts are enforced. Items without options accept only {}.
 */
export function normalizeSelections(
  item: MenuItem,
  selections: OptionSelections | undefined,
): SelectionResult {
  const input = selections ?? {};
  const options = item.options ?? [];
  const known = new Set(options.map((o) => o.id));
  for (const key of Object.keys(input)) {
    if (!known.has(key)) return { ok: false, error: "unknown-option" };
  }
  const out: OptionSelections = {};
  for (const option of options) {
    const raw = input[option.id] ?? [];
    if (!Array.isArray(raw)) return { ok: false, error: "unknown-choice" };
    const choiceIds = new Set(option.choices.map((c) => c.id));
    const picked = [...new Set(raw)].sort();
    if (picked.some((c) => typeof c !== "string" || !choiceIds.has(c))) {
      return { ok: false, error: "unknown-choice" };
    }
    if (picked.length < option.minChoices) return { ok: false, error: "too-few" };
    if (picked.length > option.maxChoices) return { ok: false, error: "too-many" };
    if (picked.length) out[option.id] = picked;
  }
  return { ok: true, selections: out };
}

export function lineKey(itemId: string, selections: OptionSelections): string {
  const parts = Object.keys(selections)
    .sort()
    .map((k) => `${k}=${selections[k].join("+")}`);
  return parts.length ? `${itemId}|${parts.join(";")}` : itemId;
}

export function totalQuantity(state: CartState): number {
  return state.lines.reduce((n, l) => n + l.quantity, 0);
}

export type CartMutation =
  | { ok: true; state: CartState; line: CartLine }
  | {
      ok: false;
      state: CartState;
      error:
        | "unknown-item"
        | NotOrderableReason
        | "invalid-options"
        | "line-limit"
        | "quantity-limit"
        | "order-limit"
        | "invalid-quantity";
    };

/** Adds `quantity` units of an item (merging with an identical line if present). */
export function addToCart(
  state: CartState,
  index: CatalogIndex,
  limits: OrderLimits,
  itemId: string,
  selections?: OptionSelections,
  quantity = 1,
): CartMutation {
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    return { ok: false, state, error: "invalid-quantity" };
  }
  const item = index.byId.get(itemId);
  if (!item) return { ok: false, state, error: "unknown-item" };
  const orderability = getOrderability(item);
  if (!orderability.orderable) return { ok: false, state, error: orderability.reason };
  const normalized = normalizeSelections(item, selections);
  if (!normalized.ok) return { ok: false, state, error: "invalid-options" };

  const key = lineKey(itemId, normalized.selections);
  const existing = state.lines.find((l) => l.key === key);
  const nextQty = (existing?.quantity ?? 0) + quantity;
  if (nextQty > limits.maxQuantityPerLine) return { ok: false, state, error: "quantity-limit" };
  if (totalQuantity(state) + quantity > limits.maxItemsPerOrder) {
    return { ok: false, state, error: "order-limit" };
  }
  if (!existing && state.lines.length >= limits.maxLines) {
    return { ok: false, state, error: "line-limit" };
  }

  const line: CartLine = { key, itemId, quantity: nextQty, selections: normalized.selections };
  const lines = existing
    ? state.lines.map((l) => (l.key === key ? line : l))
    : [...state.lines, line];
  return { ok: true, state: { lines }, line };
}

/** Sets a line's quantity. 0 removes the line. Values are clamped to the per-line limit. */
export function setLineQuantity(
  state: CartState,
  limits: OrderLimits,
  key: string,
  quantity: number,
): CartState {
  if (!Number.isFinite(quantity)) return state;
  const qty = Math.max(0, Math.min(Math.trunc(quantity), limits.maxQuantityPerLine));
  const line = state.lines.find((l) => l.key === key);
  if (!line) return state;
  if (qty === 0) return removeLine(state, key);
  const others = totalQuantity(state) - line.quantity;
  const allowed = Math.min(qty, Math.max(1, limits.maxItemsPerOrder - others));
  return { lines: state.lines.map((l) => (l.key === key ? { ...l, quantity: allowed } : l)) };
}

export function incrementLine(state: CartState, limits: OrderLimits, key: string): CartState {
  const line = state.lines.find((l) => l.key === key);
  return line ? setLineQuantity(state, limits, key, line.quantity + 1) : state;
}

export function decrementLine(state: CartState, limits: OrderLimits, key: string): CartState {
  const line = state.lines.find((l) => l.key === key);
  return line ? setLineQuantity(state, limits, key, line.quantity - 1) : state;
}

export function removeLine(state: CartState, key: string): CartState {
  return { lines: state.lines.filter((l) => l.key !== key) };
}

/** Quantity of an item across all its option configurations. */
export function quantityOfItem(state: CartState, itemId: string): number {
  return state.lines.filter((l) => l.itemId === itemId).reduce((n, l) => n + l.quantity, 0);
}
