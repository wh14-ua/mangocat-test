import { lastOrderStorageKey } from "./checkout";

/**
 * The last order placed from this browser, per storefront: which order it was, its access
 * token (to show its status again) and a fingerprint of the cart that produced it — so the
 * status page only empties THAT cart, never a newer one built afterwards (or in another tab).
 * Browser storage is a convenience: every read and write may fail and nothing depends on it.
 */
export type LastOrder = { orderId: string; token: string; at: number; cart: string; cleared?: boolean };

/** Order-independent fingerprint of cart lines (item + options + quantity). */
export function cartSignature(lines: readonly { key: string; quantity: number }[]): string {
  return lines
    .map((l) => `${l.key}×${l.quantity}`)
    .sort()
    .join("|");
}

export function readLastOrder(storefront: string): LastOrder | null {
  try {
    const raw = window.localStorage.getItem(lastOrderStorageKey(storefront));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<LastOrder>;
    if (typeof v.orderId !== "string" || typeof v.token !== "string" || typeof v.at !== "number") return null;
    return { orderId: v.orderId, token: v.token, at: v.at, cart: typeof v.cart === "string" ? v.cart : "", cleared: v.cleared === true };
  } catch {
    return null;
  }
}

export function writeLastOrder(storefront: string, value: LastOrder): void {
  try {
    window.localStorage.setItem(lastOrderStorageKey(storefront), JSON.stringify(value));
  } catch {
    /* optional */
  }
}
