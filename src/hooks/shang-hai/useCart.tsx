"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { createCartStore, type CartStore } from "@/lib/commerce/cart-store";
import { quantityOfItem } from "@/lib/commerce/cart";
import { quoteLines, type Quote } from "@/lib/commerce/pricing";
import { getOrderability } from "@/lib/commerce/catalog";
import type { MenuItem, OptionSelections } from "@/lib/commerce/types";
import { shangHaiCatalog, shangHaiOrdering } from "@/lib/shang-hai/catalog";
import { cartStorageKey } from "@/lib/shang-hai/checkout";
import type { StorefrontId } from "@/lib/shang-hai/storefronts";

const stores = new Map<string, CartStore>();

function storeFor(storefront: StorefrontId): CartStore {
  let store = stores.get(storefront);
  if (!store) {
    store = createCartStore({
      storageKey: cartStorageKey(storefront),
      index: shangHaiCatalog,
      limits: shangHaiOrdering.limits,
    });
    stores.set(storefront, store);
  }
  return store;
}

const CartContext = createContext<{ storefront: StorefrontId; store: CartStore } | null>(null);

/** One cart per storefront (each proposal behaves like an independent shop). */
export function CartProvider({
  storefront,
  children,
}: {
  storefront: StorefrontId;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ storefront, store: storeFor(storefront) }), [storefront]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export type UseCart = ReturnType<typeof useCart>;

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  const { store, storefront } = ctx;
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  // Totals are always recomputed from the current catalog; nothing stored is trusted.
  const quote: Quote = useMemo(
    () =>
      quoteLines(shangHaiCatalog, snapshot.state.lines, {
        fulfillment: "pickup",
        delivery: shangHaiOrdering.delivery,
        limits: shangHaiOrdering.limits,
      }),
    [snapshot.state],
  );

  const quantityOf = useCallback(
    (itemId: string) => quantityOfItem(snapshot.state, itemId),
    [snapshot.state],
  );

  /** The line key for an item without options (for inline steppers). */
  const simpleLineKey = useCallback(
    (itemId: string) => snapshot.state.lines.find((l) => l.itemId === itemId)?.key ?? null,
    [snapshot.state],
  );

  return {
    storefront,
    hydrated: snapshot.hydrated,
    lines: snapshot.state.lines,
    quote,
    itemCount: quote.itemCount,
    totalCents: quote.totalCents,
    lastEvent: snapshot.lastEvent,
    restoredDropped: snapshot.restoredDropped,
    dismissRestoredNotice: store.dismissRestoredNotice,
    add: (item: MenuItem | string, selections?: OptionSelections, quantity = 1) =>
      store.add(typeof item === "string" ? item : item.id, selections, quantity),
    increment: store.increment,
    decrement: store.decrement,
    setQuantity: store.setQuantity,
    remove: store.remove,
    clear: store.clear,
    quantityOf,
    simpleLineKey,
    limits: shangHaiOrdering.limits,
  };
}

/** Convenience for product rows: what the add control should do and say. */
export function useItemOrderState(item: MenuItem) {
  const { quantityOf, simpleLineKey } = useCart();
  const orderability = getOrderability(item);
  return {
    orderable: orderability.orderable,
    reason: orderability.orderable ? null : orderability.reason,
    needsOptions: Boolean(item.options?.length),
    quantity: quantityOf(item.id),
    lineKey: item.options?.length ? null : simpleLineKey(item.id),
  };
}
