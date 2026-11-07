"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { House, MagnifyingGlass, ShoppingBag, SquaresFour } from "@phosphor-icons/react/dist/ssr";
import { LanguageSwitch } from "@/components/shang-hai/shared/LanguageSwitch";
import { formatMoney } from "@/lib/i18n/format";
import { useBento } from "./hooks";
import { SearchField } from "./Menu";

/**
 * ES | EN as a two-compartment box: the language on screen is filled in black, like the
 * active category chip. Used in the desktop top bar, at the top of the mobile page and in
 * the checkout/status sub-header.
 */
export function BentoLanguageSwitch({ className }: { className?: string }) {
  const { c } = useBento();
  return (
    <LanguageSwitch
      label={c.language.groupLabel}
      className={className ? `bc-lang ${className}` : "bc-lang"}
      buttonClassName="bc-lang__btn"
      separator=""
      separatorClassName="bc-lang__wall"
    />
  );
}

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
  const { t, c } = useBento();
  return (
    <header className="bc-topbar">
      <a href="#bc-title" className="bc-topbar__brand">
        <strong>SHANG HAI</strong>
        <span>{c.brand.descriptor}</span>
      </a>
      <SearchField id="bc-search-top" value={query} onChange={setQuery} inputRef={inputRef} />
      <div className="bc-topbar__end">
        <BentoLanguageSwitch />
        <nav className="bc-topbar__nav" aria-label={t.nav.sections}>
          <a className="bc-topbar__link" href="#carta">
            {t.nav.menu}
          </a>
          <a className="bc-topbar__link" href="#info">
            {t.nav.info}
          </a>
          <button
            type="button"
            className="bc-topbar__link bc-topbar__link--cart"
            data-testid="cart-open"
            onClick={onCart}
            aria-label={count ? t.nav.yourOrderCount(count) : t.nav.yourOrder}
          >
            <ShoppingBag size={20} weight="bold" aria-hidden />
            {t.nav.order}
            {count > 0 && (
              <span key={count} className="bc-topbar__count" aria-hidden>
                {count}
              </span>
            )}
          </button>
        </nav>
      </div>
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
  const { t } = useBento();
  return (
    <nav className="bc-tabbar" aria-label={t.nav.main}>
      <button type="button" className="bc-tab" onClick={onHome} aria-current={current === "inicio" ? "true" : undefined}>
        <House size={24} weight="bold" aria-hidden />
        {t.nav.home}
      </button>
      <button type="button" className="bc-tab" onClick={onMenu} aria-current={current === "carta" ? "true" : undefined}>
        <SquaresFour size={24} weight="bold" aria-hidden />
        {t.nav.menu}
      </button>
      <button type="button" className="bc-tab" onClick={onSearch}>
        <MagnifyingGlass size={24} weight="bold" aria-hidden />
        {t.nav.search}
      </button>
      <button
        type="button"
        className="bc-tab"
        onClick={onCart}
        aria-label={count ? t.nav.orderCount(count) : t.nav.order}
        aria-haspopup="dialog"
      >
        <ShoppingBag size={24} weight="bold" aria-hidden />
        {t.nav.order}
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
  const { locale, t } = useBento();
  const total = formatMoney(totalCents, locale);
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.button
          key="minicart"
          type="button"
          className="bc-minicart"
          data-testid="cart-open"
          aria-haspopup="dialog"
          aria-label={t.nav.viewOrderCount(count, total)}
          onClick={onOpen}
          initial={reduce ? { opacity: 0 } : { y: 90, opacity: 0 }}
          animate={reduce ? { opacity: 1 } : { y: 0, opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { y: 90, opacity: 0 }}
          transition={reduce ? { duration: 0.01 } : { type: "spring", stiffness: 520, damping: 32 }}
          whileTap={reduce ? undefined : { scale: 0.97 }}
        >
          <span className="bc-minicart__sum" aria-hidden>
            <b>{count}</b> {t.count.itemWord(count)} · <b>{total}</b>
          </span>
          <span className="bc-minicart__go" aria-hidden>
            {t.nav.viewOrder}
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
