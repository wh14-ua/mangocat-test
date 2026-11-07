"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { MenuCategory, MenuItem } from "@/lib/commerce/types";
import type { Photo } from "@/data/shang-hai/photos";
import { MENU_SECTIONS, sectionOfCategory, shangHaiCatalog } from "@/lib/shang-hai/catalog";
import { categoryName, sectionName } from "@/lib/shang-hai/menu-i18n";
import { COMMON_TEXT } from "@/lib/shang-hai/i18n/common";
import type { WokCountKind } from "@/lib/shang-hai/i18n/wok-after-dark";
import { useMenuSearch } from "@/hooks/shang-hai/useMenuSearch";
import { useLocale } from "@/hooks/shang-hai/useLocale";
import { ShPhoto } from "@/components/shang-hai/shared/ShPhoto";
import { TicketCard } from "./TicketCard";
import { CategoryTicker } from "./CategoryTicker";
import { useQuantities } from "./cart-actions";
import { useWokUIActions } from "./WokUI";
import { useWokText } from "./WokLanguage";
import { wokPhotos } from "./photos";

const SECTION_PHOTOS: Partial<Record<string, Photo | undefined>> = {
  "cocina-china": wokPhotos.noodles,
  sushi: wokPhotos.sushi,
};

/** English counts drinks as drinks (the Spanish copy says "platos" for the whole carta). */
const countKind = (categoryId: string): WokCountKind =>
  sectionOfCategory(categoryId) === "bebidas" ? "drink" : "dish";

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
  photo?: Photo;
  firstCategoryId?: string;
}) {
  const reduce = useReducedMotion();
  const { locale } = useLocale();
  const t = useWokText();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <header data-cat={firstCategoryId} className="relative grid gap-6 border-t-4 border-[var(--wok-orange)] pt-4 md:grid-cols-[minmax(0,1fr)_minmax(0,19rem)] md:items-end lg:gap-10">
      <div className="wok-poster-title min-w-0">
        <p className="wok-cond text-[0.8125rem] text-[var(--wok-orange)]">
          {t.carta.sectionOf(pad(index + 1), pad(MENU_SECTIONS.length))}
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
              <ShPhoto
                photo={photo}
                alt={t.photos.alt(photo)}
                sizes="(min-width: 1024px) 304px, 40vw"
                className="h-full w-full object-cover"
              />
            </div>
            <figcaption className="wok-cond wok-muted mt-2 text-right text-[0.6875rem]">
              {COMMON_TEXT[locale].photos.illustrative}
            </figcaption>
          </figure>
        )}
        <p className="text-[1.0625rem] leading-snug md:text-[1.125rem]">{t.carta.sectionLines[id]}</p>
        <p className="wok-cond wok-muted mt-3 text-[0.8125rem]">
          {t.carta.sectionCounts({ categories, dishes, kind: id === "bebidas" ? "drink" : "dish" })}
        </p>
      </div>
    </header>
  );
}

function CategoryBlock({
  category,
  items,
  quantities,
}: {
  category: MenuCategory;
  items: MenuItem[];
  quantities: Quantities;
}) {
  const { locale } = useLocale();
  const t = useWokText();
  const categoryId = category.id;
  const name = categoryName(category, locale);
  // The Spanish carta also shows the English name the restaurant publishes for some
  // categories (now in its reviewed wording); the English carta needs no second name.
  const altName = locale === "es" && category.nameEn ? categoryName(category, "en") : null;
  const photo = categoryId === "dim-sum" ? wokPhotos.dumplings : undefined;
  const meta = (
    <p className="wok-cond wok-muted text-[0.8125rem]">
      {altName ? (
        <>
          <span lang="en">{altName}</span>
          {" / "}
        </>
      ) : null}
      {t.carta.categoryCount({ count: items.length, kind: countKind(categoryId) })}
    </p>
  );
  return (
    <div id={`cat-${categoryId}`} data-cat={categoryId} className="pt-10 lg:pt-14">
      {photo ? (
        <div className="mb-4 grid gap-4 border-b-2 border-[var(--wok-metal)] pb-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] sm:items-end">
          <div className="min-w-0">
            <h3 className="wok-display text-[clamp(2.5rem,8vw,4.75rem)]">{name}</h3>
            <div className="mt-3">{meta}</div>
          </div>
          <figure className="min-w-0">
            <div className="wok-slant aspect-[16/7] overflow-hidden bg-[var(--wok-petrol-3)]">
              <ShPhoto
                photo={photo}
                alt={t.photos.alt(photo)}
                sizes="(min-width: 1024px) 680px, 92vw"
                className="h-full w-full object-cover"
              />
            </div>
            <figcaption className="wok-cond wok-muted mt-2 text-right text-[0.6875rem]">
              {COMMON_TEXT[locale].photos.illustrative}
            </figcaption>
          </figure>
        </div>
      ) : (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-1 border-b-2 border-[var(--wok-metal)] pb-3">
          <h3 className="wok-display text-[clamp(2.5rem,8vw,4.75rem)]">{name}</h3>
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
  const { locale } = useLocale();
  const t = useWokText();
  useActiveCategoryTracking(!active);

  const resultsLabel = useMemo(() => {
    if (!active) return "";
    if (results.length === 0) return t.carta.noResultsStatus(query.trim());
    return t.carta.resultsStatus(results.length);
  }, [active, results.length, query, t]);

  return (
    <section id="carta" aria-label={t.carta.region} className="relative px-4 pb-16 pt-14 sm:px-6 lg:px-12 lg:pt-20">
      <div className="max-w-[60rem]">
        <label htmlFor="wok-search" className="wok-cond block text-[0.875rem] text-[var(--wok-orange)]">
          {t.carta.searchLabel}
        </label>
        <div className="relative mt-2">
          <input
            ref={inputRef}
            id="wok-search"
            type="search"
            data-testid="menu-search"
            className="wok-search"
            placeholder={t.carta.searchPlaceholder}
            autoComplete="off"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              aria-label={t.carta.clearSearch}
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
          {t.carta.summary(shangHaiCatalog.visibleItems.length, shangHaiCatalog.catalog.categories.length)}
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
                <span className="text-[var(--wok-orange)]">{results.length}</span> {t.carta.resultsWord(results.length)}
              </>
            ) : (
              t.carta.nothingHere
            )}
          </h2>
          {results.length ? (
            <div className="mt-6">
              <Grid items={results} quantities={quantities} level={3} />
            </div>
          ) : (
            <div className="mt-6 max-w-[38rem]">
              <p className="text-[1.125rem]">{t.carta.noMatch(query.trim())}</p>
              <button type="button" className="wok-btn wok-btn--line mt-6" onClick={() => setQuery("")}>
                {t.carta.seeAll}
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
                name={sectionName(section.id, locale)}
                index={i}
                categories={section.categories.length}
                dishes={section.dishCount}
                photo={SECTION_PHOTOS[section.id]}
                firstCategoryId={section.categories[0]?.category.id}
              />
              {section.categories.map(({ category, items }) => (
                <CategoryBlock key={category.id} category={category} items={items} quantities={quantities} />
              ))}
            </section>
          ))}
        </>
      )}
    </section>
  );
}
