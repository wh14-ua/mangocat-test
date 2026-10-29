"use client";

import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import type { MenuItem, OptionSelections } from "@/lib/commerce/types";
import { useCart } from "@/hooks/shang-hai/useCart";

type CartActions = {
  add: (item: MenuItem, selections?: OptionSelections) => boolean;
  increment: (key: string) => void;
  decrement: (key: string) => void;
};

const CartActionsContext = createContext<CartActions | null>(null);

/**
 * Stable cart actions for the 208 dish cards. Cards receive their quantity as props and
 * call these actions, so adding one dish re-renders that card only, not the whole carta.
 */
export function WokCartActionsProvider({ children }: { children: React.ReactNode }) {
  const cart = useCart();
  const ref = useRef(cart);
  useEffect(() => {
    ref.current = cart;
  });
  const actions = useMemo<CartActions>(
    () => ({
      add: (item, selections) => ref.current.add(item, selections).ok,
      increment: (key) => ref.current.increment(key),
      decrement: (key) => ref.current.decrement(key),
    }),
    [],
  );
  return <CartActionsContext.Provider value={actions}>{children}</CartActionsContext.Provider>;
}

export function useWokCartActions(): CartActions {
  const ctx = useContext(CartActionsContext);
  if (!ctx) throw new Error("useWokCartActions must be used inside <WokCartActionsProvider>");
  return ctx;
}

/** itemId -> { quantity, lineKey of the option-free line } from the current cart. */
export function useQuantities() {
  const { lines } = useCart();
  return useMemo(() => {
    const map = new Map<string, { qty: number; key: string | null }>();
    for (const line of lines) {
      const prev = map.get(line.itemId);
      const simple = Object.keys(line.selections).length === 0;
      map.set(line.itemId, {
        qty: (prev?.qty ?? 0) + line.quantity,
        key: simple ? line.key : (prev?.key ?? null),
      });
    }
    return map;
  }, [lines]);
}
