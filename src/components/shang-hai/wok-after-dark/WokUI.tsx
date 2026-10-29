"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { MenuItem } from "@/lib/commerce/types";

type WokUIActions = {
  openCart: () => void;
  closeCart: () => void;
  openMenu: () => void;
  closeMenu: () => void;
  openChooser: (item: MenuItem) => void;
  closeChooser: () => void;
  setActiveCategory: (id: string | null) => void;
};

type WokUIState = {
  cartOpen: boolean;
  menuOpen: boolean;
  chooserItem: MenuItem | null;
  activeCategory: string | null;
};

const ActionsContext = createContext<WokUIActions | null>(null);
const StateContext = createContext<WokUIState | null>(null);

/**
 * UI-only state of the Wok After Dark home (open panels, current category). Actions
 * live in their own stable context so the 208 dish cards never re-render on scroll.
 */
export function WokUIProvider({ children }: { children: React.ReactNode }) {
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chooserItem, setChooserItem] = useState<MenuItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const actions = useMemo<WokUIActions>(
    () => ({
      openCart: () => setCartOpen(true),
      closeCart: () => setCartOpen(false),
      openMenu: () => setMenuOpen(true),
      closeMenu: () => setMenuOpen(false),
      openChooser: (item) => setChooserItem(item),
      closeChooser: () => setChooserItem(null),
      setActiveCategory,
    }),
    [],
  );
  const state = useMemo(
    () => ({ cartOpen, menuOpen, chooserItem, activeCategory }),
    [cartOpen, menuOpen, chooserItem, activeCategory],
  );

  return (
    <ActionsContext.Provider value={actions}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </ActionsContext.Provider>
  );
}

export function useWokUIActions(): WokUIActions {
  const ctx = useContext(ActionsContext);
  if (!ctx) throw new Error("useWokUIActions must be used inside <WokUIProvider>");
  return ctx;
}

export function useWokUI(): WokUIState & WokUIActions {
  const actions = useWokUIActions();
  const state = useContext(StateContext);
  if (!state) throw new Error("useWokUI must be used inside <WokUIProvider>");
  return { ...state, ...actions };
}

/** Smoothly brings an in-page target into view once any scroll lock has been released. */
export function scrollToId(id: string) {
  requestAnimationFrame(() => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  });
}
