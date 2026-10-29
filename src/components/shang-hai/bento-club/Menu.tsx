"use client";

import { useEffect, useMemo, useRef } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react/dist/ssr";
import type { CartLine, MenuItem } from "@/lib/commerce/types";
import { ShPhoto } from "@/components/shang-hai/shared/ShPhoto";
import {
  ALL_CATEGORIES,
  BENTO_SECTIONS,
  CATEGORY_PHOTO,
  POPULAR_CATEGORY_IDS,
  TOTAL_VISIBLE_ITEMS,
  sectionToneOf,
} from "./data";
import { SectionArt, EmptyTrayArt } from "./Graphics";
import { ProductTile } from "./ProductTile";
import { useActiveCategory } from "./hooks";

export type TileHandlers = {
  onAdd: (item: MenuItem) => boolean;
  onChoose: (item: MenuItem) => void;
  onInc: (key: string) => void;
  onDec: (key: string) => void;
};

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
  return (
    <div className="bc-search" role="search">
      <label htmlFor={id} className="bc-sr">
        Buscar en la carta
      </label>
      <MagnifyingGlass className="bc-search__icon" size={20} weight="bold" aria-hidden />
      <input
        ref={inputRef}
        id={id}
        type="search"
        data-testid="menu-search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Busca: gyozas, maki, pato…"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
      />
      {value && (
        <button
          type="button"
          className="bc-search__clear"
          aria-label="Borrar la búsqueda"
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
    <nav aria-label="Categorías de la carta">
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
              {cat.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function PhotoCompartment({ categoryId }: { categoryId: string }) {
  const photo = CATEGORY_PHOTO[categoryId];
  if (!photo) return null;
  return (
    <li className="bc-tile bc-tile--photo">
      <figure style={{ display: "grid", gap: 6 }}>
        <div className="bc-window bc-window--soft">
          <ShPhoto photo={photo} sizes="(min-width: 1024px) 40vw, (min-width: 640px) 60vw, 92vw" />
        </div>
        <figcaption className="bc-caption">Imagen ilustrativa</figcaption>
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
          La carta
        </h2>
        <p className="bc-menu__count">
          {TOTAL_VISIBLE_ITEMS} platos en {ALL_CATEGORIES.length} secciones. Precios de la carta
          publicada por el restaurante.
        </p>
      </div>

      <div className="bc-menubar">
        <SearchField id="bc-search-menu" value={query} onChange={setQuery} inputRef={menubarSearchRef} />
        <CategoryChips activeDomId={searching ? null : active} onPick={pick} />
      </div>

      {searching ? (
        <div className="bc-results" aria-live="polite">
          <div className="bc-results__head">
            <h3 className="bc-results__title">
              {results.length
                ? `${results.length} ${results.length === 1 ? "plato" : "platos"} para «${query.trim()}»`
                : `Nada para «${query.trim()}»`}
            </h3>
            <button type="button" className="bc-linkbtn" onClick={() => setQuery("")}>
              Ver toda la carta
            </button>
          </div>
          {results.length ? (
            <ul className="bc-box" data-tone="cream">
              {results.map(tile)}
            </ul>
          ) : (
            <div className="bc-empty">
              <EmptyTrayArt className="bc-empty__art" />
              <p style={{ fontWeight: 700 }}>
                Prueba con otro nombre o abre una de estas secciones:
              </p>
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
                        {cat.label}
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
                  {section.name}
                </h2>
                <p className="bc-band__line">
                  {section.line} {section.itemCount} platos.
                </p>
              </div>
              <SectionArt section={section.id} className="bc-band__art" />
              <span className="bc-band__tape" aria-hidden />
            </header>
            {section.categories.map((cat) => (
              <section
                key={cat.category.id}
                id={cat.domId}
                className="bc-cat"
                aria-labelledby={`${cat.domId}-t`}
              >
                <h3 id={`${cat.domId}-t`} className="bc-tag" tabIndex={-1}>
                  <span className="bc-tag__name">{cat.label}</span>
                  {cat.category.nameEn && (
                    <span className="bc-tag__en" lang="en">
                      {cat.category.nameEn}
                    </span>
                  )}
                  <span className="bc-tag__count">
                    {cat.items.length}
                    <span className="bc-sr"> platos</span>
                  </span>
                </h3>
                <ul className="bc-box" data-tone={section.tone}>
                  <PhotoCompartment categoryId={cat.category.id} />
                  {cat.items.map(tile)}
                </ul>
              </section>
            ))}
          </section>
        ))
      )}
    </section>
  );
}
