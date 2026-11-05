"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { shangHaiCatalog } from "@/lib/shang-hai/catalog";
import { categoryName } from "@/lib/shang-hai/menu-i18n";
import { useLocale } from "@/hooks/shang-hai/useLocale";
import { useWokUI } from "./WokUI";
import { useWokText } from "./WokLanguage";

const CATEGORIES = shangHaiCatalog.catalog.categories;

/** Sticky horizontal category ticker; the active category gets a sliding orange bar. */
export function CategoryTicker() {
  const { activeCategory } = useWokUI();
  const reduce = useReducedMotion();
  const scroller = useRef<HTMLDivElement>(null);
  const { locale } = useLocale();
  const t = useWokText();

  useEffect(() => {
    const box = scroller.current;
    if (!box || !activeCategory) return;
    const chip = box.querySelector<HTMLElement>(`[data-ticker="${activeCategory}"]`);
    if (!chip) return;
    const left = chip.offsetLeft;
    const right = left + chip.offsetWidth;
    if (left < box.scrollLeft + 16 || right > box.scrollLeft + box.clientWidth - 16) {
      box.scrollTo({ left: Math.max(0, left - 24), behavior: reduce ? "auto" : "smooth" });
    }
  }, [activeCategory, reduce]);

  return (
    <nav
      aria-label={t.carta.tickerLabel}
      className="sticky top-14 z-30 -mx-4 mt-12 border-y border-[var(--wok-line)] bg-[var(--wok-petrol)] sm:-mx-6 lg:top-0 lg:-mx-12"
    >
      <div ref={scroller} className="wok-ticker flex overflow-x-auto px-2 sm:px-4 lg:px-10">
        {CATEGORIES.map((c) => {
          const active = c.id === activeCategory;
          return (
            <a
              key={c.id}
              href={`#cat-${c.id}`}
              data-ticker={c.id}
              aria-current={active ? "location" : undefined}
              className={
                "wok-cond relative flex h-12 shrink-0 items-center whitespace-nowrap px-3 text-[0.8125rem] transition-colors " +
                (active ? "text-[var(--wok-orange)]" : "text-[var(--wok-metal-light)] hover:text-[var(--wok-white)]")
              }
            >
              {categoryName(c, locale)}
              {active && (
                <motion.span
                  layoutId="wok-ticker-bar"
                  aria-hidden
                  className="absolute inset-x-3 bottom-0 h-[3px] bg-[var(--wok-orange)]"
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
