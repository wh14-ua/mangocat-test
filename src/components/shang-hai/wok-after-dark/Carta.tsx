"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { MenuItem } from "@/lib/commerce/types";
import {
  categoryDisplayName,
  MENU_SECTIONS,
  shangHaiCatalog,
} from "@/lib/shang-hai/catalog";
import { useMenuSearch } from "@/hooks/shang-hai/useMenuSearch";
import { ShPhoto, type PhotoLike } from "@/components/shang-hai/shared/ShPhoto";
import { TicketCard } from "./TicketCard";
import { CategoryTicker } from "./CategoryTicker";
import { useQuantities } from "./cart-actions";
import { useWokUIActions } from "./WokUI";
import { wokPhotos } from "./photos";

const SECTION_PHOTOS: Partial<Record<string, PhotoLike | undefined>> = {
  "cocina-china": wokPhotos.noodles,
  sushi: wokPhotos.sushi,
};

/** One factual line per section, written from the published categories. */
const SECTION_LINES: Record<string, string> = {
  "para-compartir": "Menús cerrados de 2 a 6 personas y combos de sushi de 14 a 33 piezas.",
  "cocina-china": "Entrantes, dim sum, sopas, pato, pollo, ternera, marisco, arroces y tallarines.",
  sushi: "Nigiris, makis, uramakis, sashimi, temakis, gunkan y poke bowls.",
  bebidas: "Cerveza, refrescos, agua, zumos, cava y vinos de la casa y de bodega.",
};

const sectionData = MENU_SECTIONS.map((section) => {
  const categories = shangHaiCatalog.sections.filter((s) =>
    (section.categoryIds as readonly string[]).includes(s.category.id),
  );
  return {
    ...section,
    categories,
    dishCount: categories.reduce((n, c) => n + c.items.length, 0),
  };
});

type Quantities = ReturnType<typeof useQuantities>;

function Grid({ items, quantities, level }: { items: MenuItem[]; quantities: Quantities; level?: 3 | 4 }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const q = quantities.get(item.id);
        return (
          <TicketCard
            key={item.id}
            item={item}
            qty={q?.qty ?? 0}
            lineKey={q?.key ?? null}
            headingLevel={level}
          />
        );
      })}
    </div>
  );
}

function SectionPoster({
  id,
  name,
  index,
  categories,
  dishes,
  photo,
  firstCategoryId,
}: {
  id: string;
  name: string;
  index: number;
  categories: number;
  dishes: number;
  photo?: PhotoLike;
  firstCategoryId?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <header data-cat={firstCategoryId} className="relative grid gap-6 border-t-4 border-[var(--wok-orange)] pt-4 md:grid-cols-[minmax(0,1fr)_minmax(0,19rem)] md:items-end lg:gap-10">
      <div className="wok-poster-title min-w-0">
        <p className="wok-cond text-[0.8125rem] text-[var(--wok-orange)]">
          Sección {String(index + 1).padStart(2, "0")} de {String(MENU_SECTIONS.length).padStart(2, "0")}
        </p>
        <motion.h2
          id={`sec-${id}-title`}
          className="wok-outline mt-3"
          initial={reduce ? false : { scale: 0.88, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7, ease: [0.2, 0.9, 0.15, 1] }}
          style={{ transformOrigin: "0% 100%" }}
        >
          {name}
        </motion.h2>
      </div>
      <div className="min-w-0">
        {photo && (
          <figure className="mb-5 hidden md:block">
            <div className="wok-slant aspect-[4/5] overflow-hidden bg-[var(--wok-petrol-3)]">
              <ShPhoto photo={photo} sizes="(min-width: 1024px) 304px, 40vw" className="h-full w-full object-cover" />
            </div>
            <figcaption className="wok-cond wok-muted mt-2 text-right text-[0.6875rem]">Imagen ilustrativa</figcaption>
          </figure>
        )}
        <p className="text-[1.0625rem] leading-snug md:text-[1.125rem]">{SECTION_LINES[id]}</p>
        <p className="wok-cond wok-muted mt-3 text-[0.8125rem]">
          {categories} {categories === 1 ? "categoría" : "categorías"} / {dishes} platos
        </p>
      </div>
    </header>
  );
}

function CategoryBlock({
  categoryId,
  name,
  nameEn,
  items,
  quantities,
}: {
  categoryId: string;
  name: string;
  nameEn?: string;
  items: MenuItem[];
  quantities: Quantities;
}) {
  const photo = categoryId === "dim-sum" ? wokPhotos.dumplings : undefined;
  const meta = (
    <p className="wok-cond wok-muted text-[0.8125rem]">
      {nameEn ? `${nameEn} / ` : ""}
      {items.length} {items.length === 1 ? "plato" : "platos"}
    </p>
  );
  return (
    <div id={`cat-${categoryId}`} data-cat={categoryId} className="pt-10 lg:pt-14">
      {photo ? (
        <div className="mb-4 grid gap-4 border-b-2 border-[var(--wok-metal)] pb-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] sm:items-end">
          <div className="min-w-0">
            <h3 className="wok-display text-[clamp(2.5rem,8vw,4.75rem)]">{categoryDisplayName(categoryId, name)}</h3>
            <div className="mt-3">{meta}</div>
          </div>
          <figure className="min-w-0">
            <div className="wok-slant aspect-[16/7] overflow-hidden bg-[var(--wok-petrol-3)]">
              <ShPhoto photo={photo} sizes="(min-width: 1024px) 680px, 92vw" className="h-full w-full object-cover" />
            </div>
            <figcaption className="wok-cond wok-muted mt-2 text-right text-[0.6875rem]">Imagen ilustrativa</figcaption>
          </figure>
        </div>
      ) : (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-1 border-b-2 border-[var(--wok-metal)] pb-3">
          <h3 className="wok-display text-[clamp(2.5rem,8vw,4.75rem)]">{categoryDisplayName(categoryId, name)}</h3>
          {meta}
        </div>
      )}
      <Grid items={items} quantities={quantities} />
    </div>
  );
}

/** Follows which category is in the reading band, for the ticker, rail and drawer. */
function useActiveCategoryTracking(enabled: boolean) {
  const { setActiveCategory } = useWokUIActions();
  useEffect(() => {
    if (!enabled) return;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-cat]"));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) {
          const top = visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
          setActiveCategory(top.target.getAttribute("data-cat"));
        }
      },
      { rootMargin: "-30% 0px -65% 0px" },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [enabled, setActiveCategory]);
}

export function Carta() {
  const { query, setQuery, results, active } = useMenuSearch();
  const quantities = useQuantities();
  const inputRef = useRef<HTMLInputElement>(null);
  useActiveCategoryTracking(!active);

  const resultsLabel = useMemo(() => {
    if (!active) return "";
    if (results.length === 0) return `Sin resultados para «${query.trim()}»`;
    return `${results.length} ${results.length === 1 ? "plato encontrado" : "platos encontrados"}`;
  }, [active, results.length, query]);

  return (
    <section id="carta" aria-label="Carta" className="relative px-4 pb-16 pt-14 sm:px-6 lg:px-12 lg:pt-20">
      <div className="max-w-[60rem]">
        <label htmlFor="wok-search" className="wok-cond block text-[0.875rem] text-[var(--wok-orange)]">
          Busca un plato
        </label>
        <div className="relative mt-2">
          <input
            ref={inputRef}
            id="wok-search"
            type="search"
            data-testid="menu-search"
            className="wok-search"
            placeholder="Gyozas, pato, maki…"
            autoComplete="off"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              aria-label="Borrar la búsqueda"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="absolute right-0 top-1/2 grid size-11 -translate-y-1/2 place-items-center text-[var(--wok-white)] hover:text-[var(--wok-orange)]"
            >
              <span aria-hidden className="relative block size-5 before:absolute before:inset-x-0 before:top-1/2 before:h-[3px] before:-translate-y-1/2 before:rotate-45 before:bg-current after:absolute after:inset-x-0 after:top-1/2 after:h-[3px] after:-translate-y-1/2 after:-rotate-45 after:bg-current" />
            </button>
          )}
        </div>
        <p className="wok-muted mt-3 text-[0.875rem]">
          {shangHaiCatalog.visibleItems.length} platos en {shangHaiCatalog.catalog.categories.length} categorías.
          Carta y precios según la ficha pública del restaurante (29/10/2026).
        </p>
      </div>

      <p role="status" className="wok-sr">
        {resultsLabel}
      </p>

      {active ? (
        <section aria-labelledby="wok-results-title" className="mt-10">
          <h2 id="wok-results-title" className="wok-display text-[clamp(2.75rem,9vw,5.5rem)]">
            {results.length ? (
              <>
                <span className="text-[var(--wok-orange)]">{results.length}</span>{" "}
                {results.length === 1 ? "resultado" : "resultados"}
              </>
            ) : (
              "Nada por aquí"
            )}
          </h2>
          {results.length ? (
            <div className="mt-6">
              <Grid items={results} quantities={quantities} level={3} />
            </div>
          ) : (
            <div className="mt-6 max-w-[38rem]">
              <p className="text-[1.125rem]">
                No hay platos que coincidan con «{query.trim()}». Prueba con «pato», «maki» o «gyozas».
              </p>
              <button type="button" className="wok-btn wok-btn--line mt-6" onClick={() => setQuery("")}>
                Ver toda la carta
              </button>
            </div>
          )}
        </section>
      ) : (
        <>
          <CategoryTicker />
          {sectionData.map((section, i) => (
            <section
              key={section.id}
              id={`sec-${section.id}`}
              aria-labelledby={`sec-${section.id}-title`}
              className="pt-16 lg:pt-24"
            >
              <SectionPoster
                id={section.id}
                name={section.name}
                index={i}
                categories={section.categories.length}
                dishes={section.dishCount}
                photo={SECTION_PHOTOS[section.id]}
                firstCategoryId={section.categories[0]?.category.id}
              />
              {section.categories.map(({ category, items }) => (
                <CategoryBlock
                  key={category.id}
                  categoryId={category.id}
                  name={category.name}
                  nameEn={category.nameEn}
                  items={items}
                  quantities={quantities}
                />
              ))}
            </section>
          ))}
        </>
      )}
    </section>
  );
}
