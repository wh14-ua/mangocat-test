"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { House, MagnifyingGlass, ShoppingBag, SquaresFour } from "@phosphor-icons/react/dist/ssr";
import { formatCents } from "@/lib/commerce/money";
import { SearchField } from "./Menu";

/** Desktop (≥1024 px): brand, the big search and the order button. */
export function TopBar({
  query,
  setQuery,
  inputRef,
  count,
  onCart,
}: {
  query: string;
  setQuery: (q: string) => void;
  inputRef: React.Ref<HTMLInputElement>;
  count: number;
  onCart: () => void;
}) {
  return (
    <header className="bc-topbar">
      <a href="#bc-title" className="bc-topbar__brand">
        <strong>SHANG HAI</strong>
        <span>Restaurante Asiático · Orihuela</span>
      </a>
      <SearchField id="bc-search-top" value={query} onChange={setQuery} inputRef={inputRef} />
      <nav className="bc-topbar__nav" aria-label="Secciones de la página">
        <a className="bc-topbar__link" href="#carta">
          Carta
        </a>
        <a className="bc-topbar__link" href="#info">
          Información
        </a>
        <button
          type="button"
          className="bc-topbar__link bc-topbar__link--cart"
          data-testid="cart-open"
          onClick={onCart}
          aria-label={count ? `Tu pedido: ${count} ${count === 1 ? "producto" : "productos"}` : "Tu pedido"}
        >
          <ShoppingBag size={20} weight="bold" aria-hidden />
          Pedido
          {count > 0 && (
            <span key={count} className="bc-topbar__count" aria-hidden>
              {count}
            </span>
          )}
        </button>
      </nav>
    </header>
  );
}

/** Mobile/tablet: four-tab bar fixed to the bottom edge. */
export function TabBar({
  count,
  onHome,
  onMenu,
  onSearch,
  onCart,
  current,
}: {
  count: number;
  onHome: () => void;
  onMenu: () => void;
  onSearch: () => void;
  onCart: () => void;
  current: "inicio" | "carta";
}) {
  return (
    <nav className="bc-tabbar" aria-label="Navegación principal">
      <button type="button" className="bc-tab" onClick={onHome} aria-current={current === "inicio" ? "true" : undefined}>
        <House size={24} weight="bold" aria-hidden />
        Inicio
      </button>
      <button type="button" className="bc-tab" onClick={onMenu} aria-current={current === "carta" ? "true" : undefined}>
        <SquaresFour size={24} weight="bold" aria-hidden />
        Carta
      </button>
      <button type="button" className="bc-tab" onClick={onSearch}>
        <MagnifyingGlass size={24} weight="bold" aria-hidden />
        Buscar
      </button>
      <button
        type="button"
        className="bc-tab"
        onClick={onCart}
        aria-label={count ? `Pedido: ${count} ${count === 1 ? "producto" : "productos"}` : "Pedido"}
        aria-haspopup="dialog"
      >
        <ShoppingBag size={24} weight="bold" aria-hidden />
        Pedido
        {count > 0 && (
          <span key={count} className="bc-badge" aria-hidden>
            {count}
          </span>
        )}
      </button>
    </nav>
  );
}

/** Floating bar above the tabs while the order has items: the fastest way to pay. */
export function MiniCart({
  count,
  totalCents,
  onOpen,
}: {
  count: number;
  totalCents: number;
  onOpen: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.button
          key="minicart"
          type="button"
          className="bc-minicart"
          data-testid="cart-open"
          aria-haspopup="dialog"
          aria-label={`Ver pedido: ${count} ${count === 1 ? "producto" : "productos"}, ${formatCents(totalCents)}`}
          onClick={onOpen}
          initial={reduce ? { opacity: 0 } : { y: 90, opacity: 0 }}
          animate={reduce ? { opacity: 1 } : { y: 0, opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { y: 90, opacity: 0 }}
          transition={reduce ? { duration: 0.01 } : { type: "spring", stiffness: 520, damping: 32 }}
          whileTap={reduce ? undefined : { scale: 0.97 }}
        >
          <span className="bc-minicart__sum" aria-hidden>
            <b>{count}</b> {count === 1 ? "producto" : "productos"} · <b>{formatCents(totalCents)}</b>
          </span>
          <span className="bc-minicart__go" aria-hidden>
            Ver pedido
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
