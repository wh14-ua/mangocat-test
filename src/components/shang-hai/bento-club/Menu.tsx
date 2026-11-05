"use client";

import { useEffect, useMemo, useRef } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react/dist/ssr";
import type { CartLine, MenuCategory, MenuItem } from "@/lib/commerce/types";
import type { Locale } from "@/lib/i18n/locale";
import { categoryName, sectionName } from "@/lib/shang-hai/menu-i18n";
import { ShPhoto } from "@/components/shang-hai/shared/ShPhoto";
import {
  ALL_CATEGORIES,
  BENTO_SECTIONS,
  CATEGORY_PHOTO,
  POPULAR_CATEGORY_IDS,
  TOTAL_VISIBLE_ITEMS,
  bentoPhoto,
  sectionLine,
  sectionToneOf,
} from "./data";
import { SectionArt, EmptyTrayArt } from "./Graphics";
import { ProductTile } from "./ProductTile";
import { useActiveCategory, useBento } from "./hooks";

export type TileHandlers = {
  onAdd: (item: MenuItem) => boolean;
  onChoose: (item: MenuItem) => void;
  onInc: (key: string) => void;
  onDec: (key: string) => void;
};

/**
 * The second name printed on a category tag. Spanish keeps today's bilingual tags (the
 * English name, where the restaurant published one); in English the tag needs no echo.
 */
function tagSecondName(category: MenuCategory, locale: Locale): string | null {
  if (locale !== "es" || !category.nameEn) return null;
  const en = categoryName(category, "en");
  return en.toLowerCase() === categoryName(category, "es").toLowerCase() ? null : en;
}

export function SearchField({
  id,
  value,
  onChange,
  inputRef,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const { t } = useBento();
  return (
    <div className="bc-search" role="search">
      <label htmlFor={id} className="bc-sr">
        {t.menu.searchLabel}
      </label>
      <MagnifyingGlass className="bc-search__icon" size={20} weight="bold" aria-hidden />
      <input
        ref={inputRef}
        id={id}
        type="search"
        data-testid="menu-search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t.menu.searchPlaceholder}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
      />
      {value && (
        <button
          type="button"
          className="bc-search__clear"
          aria-label={t.menu.clearSearch}
          onClick={() => onChange("")}
        >
          <X size={18} weight="bold" aria-hidden />
        </button>
      )}
    </div>
  );
}

function CategoryChips({
  activeDomId,
  onPick,
}: {
  activeDomId: string | null;
  onPick: (domId: string) => void;
}) {
  const { locale, t } = useBento();
  const listRef = useRef<HTMLUListElement>(null);

  // Keep the active chip in view inside the horizontal strip (never scrolls the page).
  useEffect(() => {
    const list = listRef.current;
    const chip = list?.querySelector<HTMLElement>(`[data-dom="${activeDomId}"]`);
    if (!list || !chip) return;
    const left = chip.offsetLeft - list.clientWidth / 2 + chip.clientWidth / 2;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.scrollTo({ left, behavior: reduce ? "auto" : "smooth" });
  }, [activeDomId]);

  return (
    <nav aria-label={t.menu.categories}>
      <ul ref={listRef} className="bc-chips">
        {ALL_CATEGORIES.map((cat) => (
          <li key={cat.category.id}>
            <a
              href={`#${cat.domId}`}
              className="bc-chip"
              data-dom={cat.domId}
              data-tone={sectionToneOf(cat.category.id)}
              aria-current={activeDomId === cat.domId ? "true" : undefined}
              onClick={(e) => {
                e.preventDefault();
                onPick(cat.domId);
              }}
            >
              <span className="bc-chip__dot" aria-hidden />
              {categoryName(cat.category, locale)}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function PhotoCompartment({ categoryId }: { categoryId: string }) {
  const { t, c } = useBento();
  const key = CATEGORY_PHOTO[categoryId];
  if (!key) return null;
  return (
    <li className="bc-tile bc-tile--photo">
      <figure style={{ display: "grid", gap: 6 }}>
        <div className="bc-window bc-window--soft">
          <ShPhoto
            photo={bentoPhoto(key)}
            alt={t.photoAlt[key]}
            sizes="(min-width: 1024px) 40vw, (min-width: 640px) 60vw, 92vw"
          />
        </div>
        <figcaption className="bc-caption">{c.photos.illustrative}</figcaption>
      </figure>
    </li>
  );
}

type Quantities = { qty: Map<string, number>; keyOf: Map<string, string> };

function useQuantities(lines: CartLine[]): Quantities {
  return useMemo(() => {
    const qty = new Map<string, number>();
    const keyOf = new Map<string, string>();
    for (const l of lines) {
      qty.set(l.itemId, (qty.get(l.itemId) ?? 0) + l.quantity);
      if (Object.keys(l.selections).length === 0) keyOf.set(l.itemId, l.key);
    }
    return { qty, keyOf };
  }, [lines]);
}

export function MenuBoard({
  query,
  setQuery,
  results,
  searching,
  lines,
  max,
  handlers,
  menubarSearchRef,
  isDesktop,
}: {
  query: string;
  setQuery: (q: string) => void;
  results: MenuItem[];
  searching: boolean;
  lines: CartLine[];
  max: number;
  handlers: TileHandlers;
  menubarSearchRef: React.Ref<HTMLInputElement>;
  isDesktop: boolean;
}) {
  const { locale, t } = useBento();
  const { qty, keyOf } = useQuantities(lines);
  const domIds = useMemo(() => ALL_CATEGORIES.map((c) => c.domId), []);
  const active = useActiveCategory(domIds, !searching, isDesktop ? 146 : 128);

  function pick(domId: string) {
    const go = () => {
      const el = document.getElementById(domId);
      if (!el) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      el.querySelector<HTMLElement>("h3")?.focus({ preventScroll: true });
    };
    if (searching) {
      setQuery("");
      requestAnimationFrame(() => requestAnimationFrame(go));
    } else go();
  }

  const tile = (item: MenuItem) => (
    <ProductTile
      key={item.id}
      item={item}
      quantity={qty.get(item.id) ?? 0}
      lineKey={keyOf.get(item.id) ?? null}
      max={max}
      onAdd={handlers.onAdd}
      onChoose={handlers.onChoose}
      onInc={handlers.onInc}
      onDec={handlers.onDec}
    />
  );

  return (
    <section id="carta" className="bc-menu" aria-labelledby="bc-menu-title">
      <div className="bc-menu__intro">
        <h2 id="bc-menu-title" className="bc-menu__title">
          {t.menu.title}
        </h2>
        <p className="bc-menu__count">{t.menu.intro(TOTAL_VISIBLE_ITEMS, ALL_CATEGORIES.length)}</p>
      </div>

      <div className="bc-menubar">
        <SearchField id="bc-search-menu" value={query} onChange={setQuery} inputRef={menubarSearchRef} />
        <CategoryChips activeDomId={searching ? null : active} onPick={pick} />
      </div>

      {searching ? (
        <div className="bc-results" aria-live="polite">
          <div className="bc-results__head">
            <h3 className="bc-results__title">
              {results.length ? t.menu.results(results.length, query.trim()) : t.menu.noResults(query.trim())}
            </h3>
            <button type="button" className="bc-linkbtn" onClick={() => setQuery("")}>
              {t.menu.seeAll}
            </button>
          </div>
          {results.length ? (
            <ul className="bc-box" data-tone="cream">
              {results.map(tile)}
            </ul>
          ) : (
            <div className="bc-empty">
              <EmptyTrayArt className="bc-empty__art" />
              <p style={{ fontWeight: 700 }}>{t.menu.tryAnother}</p>
              <ul className="bc-empty__chips">
                {POPULAR_CATEGORY_IDS.map((id) => {
                  const cat = ALL_CATEGORIES.find((c) => c.category.id === id);
                  if (!cat) return null;
                  return (
                    <li key={id}>
                      <a
                        href={`#${cat.domId}`}
                        className="bc-chip"
                        data-tone={sectionToneOf(id)}
                        onClick={(e) => {
                          e.preventDefault();
                          pick(cat.domId);
                        }}
                      >
                        {categoryName(cat.category, locale)}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      ) : (
        BENTO_SECTIONS.map((section) => (
          <section
            key={section.id}
            id={section.domId}
            className="bc-section"
            aria-labelledby={`${section.domId}-t`}
          >
            <header className="bc-band" data-tone={section.tone}>
              <div>
                <h2 id={`${section.domId}-t`} className="bc-band__name">
                  {sectionName(section.id, locale)}
                </h2>
                <p className="bc-band__line">
                  {sectionLine(section.id, t)} {t.menu.sectionCount(section.itemCount)}
                </p>
              </div>
              <SectionArt section={section.id} className="bc-band__art" />
              <span className="bc-band__tape" aria-hidden />
            </header>
            {section.categories.map((cat) => {
              const second = tagSecondName(cat.category, locale);
              return (
                <section
                  key={cat.category.id}
                  id={cat.domId}
                  className="bc-cat"
                  aria-labelledby={`${cat.domId}-t`}
                >
                  <h3 id={`${cat.domId}-t`} className="bc-tag" tabIndex={-1}>
                    <span className="bc-tag__name">{categoryName(cat.category, locale)}</span>
                    {second && (
                      <span className="bc-tag__en" lang="en">
                        {second}
                      </span>
                    )}
                    <span className="bc-tag__count">
                      {cat.items.length}
                      <span className="bc-sr">{t.menu.dishesSr}</span>
                    </span>
                  </h3>
                  <ul className="bc-box" data-tone={section.tone}>
                    <PhotoCompartment categoryId={cat.category.id} />
                    {cat.items.map(tile)}
                  </ul>
                </section>
              );
            })}
          </section>
        ))
      )}
    </section>
  );
}
