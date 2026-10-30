"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useCart } from "@/hooks/shang-hai/useCart";
import { NOT_ORDERABLE_COPY, type NotOrderableReason } from "@/lib/commerce/catalog";
import type { MenuItem, OptionSelections } from "@/lib/commerce/types";

type AddError =
  | NotOrderableReason
  | "unknown-item"
  | "invalid-options"
  | "line-limit"
  | "quantity-limit"
  | "order-limit"
  | "invalid-quantity";

const ADD_ERROR_COPY: Record<AddError, string> = {
  ...NOT_ORDERABLE_COPY,
  "unknown-item": "Este plato ya no está en la carta.",
  "invalid-options": "Elige una opción antes de añadirlo.",
  "line-limit": "Has llegado al máximo de productos distintos en un pedido online.",
  "quantity-limit": "Has llegado al máximo de unidades de este plato.",
  "order-limit": "Has llegado al máximo de unidades de un pedido online.",
  "invalid-quantity": "Revisa la cantidad.",
};

type InkUIValue = {
  cartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  optionItem: MenuItem | null;
  closeOptions: () => void;
  /** Adds an item (or opens the option chooser first). Returns true when added. */
  addItem: (item: MenuItem, selections?: OptionSelections) => boolean;
  /** Increments on every successful add: drives the seal "stamp" feedback. */
  stamp: number;
  announce: (message: string) => void;
};

const InkUIContext = createContext<InkUIValue | null>(null);

export function useInkUI(): InkUIValue {
  const ctx = useContext(InkUIContext);
  if (!ctx) throw new Error("useInkUI must be used inside <InkUIProvider>");
  return ctx;
}

/** Drawer, option chooser and live announcements shared by every Ink House page. */
export function InkUIProvider({ children }: { children: React.ReactNode }) {
  const cart = useCart();
  const cartRef = useRef(cart);
  useEffect(() => {
    cartRef.current = cart;
  });

  const [cartOpen, setCartOpen] = useState(false);
  const [optionItem, setOptionItem] = useState<MenuItem | null>(null);
  const [stamp, setStamp] = useState(0);
  const [message, setMessage] = useState("");
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close overlays when the route changes (the layout, and this state, persist).
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setCartOpen(false);
    setOptionItem(null);
  }

  const announce = useCallback((text: string) => {
    setMessage("");
    if (clearTimer.current) clearTimeout(clearTimer.current);
    // A fresh node content guarantees screen readers repeat identical messages.
    clearTimer.current = setTimeout(() => setMessage(text), 40);
  }, []);

  const addItem = useCallback(
    (item: MenuItem, selections?: OptionSelections) => {
      if (item.options?.length && !selections) {
        setOptionItem(item);
        return false;
      }
      const result = cartRef.current.add(item, selections);
      if (result.ok) {
        const count = result.state.lines.reduce((n, l) => n + l.quantity, 0);
        setStamp((s) => s + 1);
        announce(
          `Añadido: ${item.name}. Tu pedido tiene ${count} ${count === 1 ? "producto" : "productos"}.`,
        );
        return true;
      }
      announce(ADD_ERROR_COPY[result.error]);
      return false;
    },
    [announce],
  );

  const value = useMemo<InkUIValue>(
    () => ({
      cartOpen,
      openCart: () => setCartOpen(true),
      closeCart: () => setCartOpen(false),
      optionItem,
      closeOptions: () => setOptionItem(null),
      addItem,
      stamp,
      announce,
    }),
    [cartOpen, optionItem, addItem, stamp, announce],
  );

  return (
    <InkUIContext.Provider value={value}>
      {children}
      <div className="ink-sr-only" role="status" aria-live="polite" aria-atomic="true">
        {message}
      </div>
    </InkUIContext.Provider>
  );
}
