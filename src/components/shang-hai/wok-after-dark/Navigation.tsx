"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MENU_SECTIONS, sectionOfCategory, shangHaiCatalog } from "@/lib/shang-hai/catalog";
import { categoryName, sectionName } from "@/lib/shang-hai/menu-i18n";
import { COMMON_TEXT } from "@/lib/shang-hai/i18n/common";
import { useDialog } from "@/hooks/shang-hai/useDialog";
import { useCart } from "@/hooks/shang-hai/useCart";
import { useLocale } from "@/hooks/shang-hai/useLocale";
import { scrollToId, useWokUI } from "./WokUI";
import { useWokText, WokLanguageSwitch } from "./WokLanguage";

/** "SH" block. The letters are CSS-generated so links keep their visible label as name. */
export function Monogram({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`wok-mono grid size-10 shrink-0 place-items-center bg-[var(--wok-orange)] font-[family-name:var(--wok-display)] text-[1.35rem] font-black leading-none text-[var(--wok-petrol)] ${className}`}
    />
  );
}

/** Desktop: a fixed left rail with the four sections as vertical labels. */
export function SideRail() {
  const { activeCategory } = useWokUI();
  const { locale } = useLocale();
  const t = useWokText();
  const atInfo = activeCategory === "info";
  const activeSection = activeCategory && !atInfo ? sectionOfCategory(activeCategory) : null;
  return (
    <aside className="sticky top-0 z-40 hidden h-[100dvh] w-[76px] shrink-0 flex-col items-center border-r border-[var(--wok-line)] bg-[var(--wok-petrol)] pb-12 pt-5 lg:flex">
      <a href="#inicio" aria-label={t.nav.brandHome} className="block">
        <Monogram className="size-12 text-[1.6rem]" />
      </a>
      <nav aria-label={t.nav.sections} className="mt-6 flex flex-1 flex-col items-center justify-center gap-1">
        {MENU_SECTIONS.map((s) => {
          const active = s.id === activeSection;
          return (
            <a
              key={s.id}
              href={`#sec-${s.id}`}
              aria-current={active ? "location" : undefined}
              className={
                "relative flex w-[76px] justify-center py-3 transition-colors " +
                (active ? "text-[var(--wok-orange)]" : "text-[var(--wok-metal-light)] hover:text-[var(--wok-white)]")
              }
            >
              {active && <span aria-hidden className="absolute inset-y-2 left-0 w-1 bg-[var(--wok-orange)]" />}
              <span className="wok-rail-label">{sectionName(s.id, locale)}</span>
            </a>
          );
        })}
        <span aria-hidden className="my-2 h-px w-8 bg-[var(--wok-line)]" />
        <a
          href="#info"
          aria-current={atInfo ? "location" : undefined}
          className={
            "relative flex w-[76px] justify-center py-3 transition-colors " +
            (atInfo ? "text-[var(--wok-orange)]" : "text-[var(--wok-metal-light)] hover:text-[var(--wok-white)]")
          }
        >
          {atInfo && <span aria-hidden className="absolute inset-y-2 left-0 w-1 bg-[var(--wok-orange)]" />}
          <span className="wok-rail-label">{t.nav.pickup}</span>
        </a>
      </nav>
      <WokLanguageSwitch variant="rail" className="mt-4" />
    </aside>
  );
}

/** Mobile and tablet: brand bar with the menu drawer trigger. */
export function TopBar() {
  const { openMenu, menuOpen } = useWokUI();
  const t = useWokText();
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-[var(--wok-line)] bg-[var(--wok-petrol)] pl-3 pr-1 sm:pl-5 lg:hidden">
      {/* The wordmark folds into the SH block when the bar is too narrow for it and ES | EN. */}
      <div className="wok-bar-brand min-w-0 flex-1">
        <a href="#inicio" className="flex w-fit max-w-full items-center gap-2.5">
          <Monogram className="size-9 text-[1.15rem]" />
          <span className="wok-bar-word wok-display truncate text-[1.6rem] leading-none">Shang Hai</span>
          <span className="wok-sr">{t.nav.backToTop}</span>
        </a>
      </div>
      <div className="flex shrink-0 items-center">
        <WokLanguageSwitch />
        <button
          type="button"
          onClick={openMenu}
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          className="wok-cond flex h-12 items-center gap-2.5 px-3 text-[0.9375rem] text-[var(--wok-white)]"
        >
          {t.nav.menu}
          <span aria-hidden className="flex w-6 flex-col gap-[5px]">
            <span className="h-[3px] bg-current" />
            <span className="h-[3px] w-4 bg-[var(--wok-orange)]" />
            <span className="h-[3px] bg-current" />
          </span>
        </button>
      </div>
    </header>
  );
}

/** Mobile drawer from the left: sections and categories in big type. */
export function MenuDrawer() {
  const { menuOpen, closeMenu, openCart, activeCategory } = useWokUI();
  const { itemCount } = useCart();
  const { locale } = useLocale();
  const t = useWokText();
  const common = COMMON_TEXT[locale];
  const reduce = useReducedMotion();
  const ref = useDialog<HTMLDivElement>(menuOpen, closeMenu);

  const jump = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    closeMenu();
    scrollToId(id);
  };

  return (
    <AnimatePresence>
      {menuOpen && (
        <div className="fixed inset-0 z-[90] lg:hidden">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-[rgba(8,15,18,0.78)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            onClick={closeMenu}
          />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wok-drawer-title"
            className="absolute inset-y-0 left-0 flex w-[min(92vw,26rem)] flex-col bg-[var(--wok-petrol-2)]"
            initial={reduce ? { opacity: 0 } : { x: "-100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "-100%" }}
            transition={{ duration: reduce ? 0 : 0.32, ease: [0.2, 0.9, 0.15, 1] }}
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--wok-line)] pl-4 pr-1">
              <h2 id="wok-drawer-title" className="wok-display text-[1.75rem]">
                {t.nav.menu}
              </h2>
              <button
                type="button"
                onClick={closeMenu}
                className="wok-cond flex h-12 items-center gap-2 px-3 text-[0.9375rem]"
              >
                {t.nav.close}
                <span aria-hidden className="relative block size-4 before:absolute before:inset-x-0 before:top-1/2 before:h-[3px] before:-translate-y-1/2 before:rotate-45 before:bg-current after:absolute after:inset-x-0 after:top-1/2 after:h-[3px] after:-translate-y-1/2 after:-rotate-45 after:bg-current" />
              </button>
            </div>
            <nav aria-label={t.nav.drawerNav} className="flex-1 overflow-y-auto overscroll-contain px-4 pb-8 pt-4">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--wok-line)] pb-3">
                <p aria-hidden className="wok-cond text-[0.8125rem] text-[var(--wok-metal-light)]">
                  {common.language.groupLabel}
                </p>
                <WokLanguageSwitch className="-mr-1" />
              </div>
              {MENU_SECTIONS.map((s) => (
                <div key={s.id} className="border-b border-[var(--wok-line)] py-4">
                  <a
                    href={`#sec-${s.id}`}
                    onClick={jump(`sec-${s.id}`)}
                    className="wok-display block text-[2.6rem] hover:text-[var(--wok-orange)]"
                  >
                    {sectionName(s.id, locale)}
                  </a>
                  <ul className="mt-3 grid grid-cols-2 gap-x-3">
                    {s.categoryIds.map((cid) => {
                      const cat = shangHaiCatalog.categoryById.get(cid);
                      if (!cat) return null;
                      const active = cid === activeCategory;
                      return (
                        <li key={cid}>
                          <a
                            href={`#cat-${cid}`}
                            onClick={jump(`cat-${cid}`)}
                            aria-current={active ? "location" : undefined}
                            className={
                              "wok-cond flex min-h-11 items-center text-[0.875rem] " +
                              (active ? "text-[var(--wok-orange)]" : "text-[var(--wok-metal-light)] hover:text-[var(--wok-white)]")
                            }
                          >
                            {categoryName(cat, locale)}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              <div className="grid gap-2 pt-5">
                <a href="#info" onClick={jump("info")} className="wok-btn wok-btn--line justify-between">
                  {t.nav.pickupAndHours}
                </a>
                <button
                  type="button"
                  className="wok-btn wok-btn--hot justify-between"
                  onClick={() => {
                    closeMenu();
                    openCart();
                  }}
                >
                  {t.nav.ticket} <span className="wok-nums">{itemCount}</span>
                </button>
              </div>
            </nav>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
