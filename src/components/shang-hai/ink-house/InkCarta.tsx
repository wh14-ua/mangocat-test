"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useCart } from "@/hooks/shang-hai/useCart";
import { useMenuSearch } from "@/hooks/shang-hai/useMenuSearch";
import type { MenuItem } from "@/lib/commerce/types";
import { ShPhoto } from "@/components/shang-hai/shared/ShPhoto";
import { useInkUI } from "./InkUI";
import { InkRow, type RowCartState } from "./InkRow";
import { CHAPTER_BY_CATEGORY, CHAPTERS, PARTS, platosLabel, VISIBLE_DISH_COUNT } from "./chapters";
import { goToAnchor } from "./InkHeader";
import { inkPhotos } from "./ink-photos";

const EMPTY: RowCartState = { quantity: 0, lineKey: null };

/** Photographic plates placed before two chapters, like plates bound into a book. */
const PLATES: Record<string, { number: number; photo: keyof typeof inkPhotos }> = {
  "dim-sum": { number: 1, photo: "dimsum" },
  nigiris: { number: 2, photo: "sushi" },
};

export function InkCarta() {
  const cart = useCart();
  const ui = useInkUI();
  const search = useMenuSearch();
  const [active, setActive] = useState(CHAPTERS[0].id);

  // One subscription for the whole carta; rows are memoized and only re-render when
  // their own quantity changes.
  const cartByItem = useMemo(() => {
    const map = new Map<string, RowCartState>();
    for (const line of cart.lines) {
      const prev = map.get(line.itemId);
      const hasOptions = Object.keys(line.selections).length > 0;
      map.set(line.itemId, {
        quantity: (prev?.quantity ?? 0) + line.quantity,
        lineKey: hasOptions || prev ? null : line.key,
      });
    }
    return map;
  }, [cart.lines]);

  const { increment, decrement } = cart;
  const { addItem } = ui;
  const onAdd = useCallback((item: MenuItem) => addItem(item), [addItem]);
  const onIncrement = useCallback((key: string) => increment(key), [increment]);
  const onDecrement = useCallback((key: string) => decrement(key), [decrement]);

  // Index: mark the chapter currently being read.
  useEffect(() => {
    if (search.active) return;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-chapter]"));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.getAttribute("data-chapter") as string);
      },
      { rootMargin: "-22% 0px -70% 0px" },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [search.active]);

  const jumpTo = (anchor: string) => {
    if (search.active) search.setQuery("");
    goToAnchor(anchor);
  };

  const rowProps = { onAdd, onIncrement, onDecrement };

  return (
    <section id="carta" className="ink-carta" aria-labelledby="ink-carta-title">
      <div className="ink-carta__body">
        <nav className="ink-index" aria-label="Índice de la carta">
          <p className="ink-index__title">Índice</p>
          {PARTS.map((part) => (
            <div key={part.id} className="ink-index__part">
              <p className="ink-index__part-title">{part.title}</p>
              <ol className="ink-index__list">
                {part.chapters.map((c) => (
                  <li key={c.id}>
                    <a
                      href={`#${c.anchor}`}
                      className="ink-index__link"
                      aria-current={!search.active && active === c.id ? "location" : undefined}
                      onClick={(e) => {
                        e.preventDefault();
                        jumpTo(c.anchor);
                      }}
                    >
                      <span className="ink-num">{c.number}</span>
                      <span className="ink-index__name">{c.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </nav>

        <div className="ink-chapters">
          <div className="ink-carta__head">
            <h2 id="ink-carta-title" className="ink-carta__title" tabIndex={-1} data-anchor-focus>
              La carta
            </h2>
            <p className="ink-carta__intro">
              {CHAPTERS.length} capítulos y {VISIBLE_DISH_COUNT} platos, en el orden de la casa. Los
              pedidos online son para recoger en el local.
            </p>
            <div className="ink-search" role="search">
              <label htmlFor="ink-search" className="ink-search__label">
                Buscar en la carta
              </label>
              <div className="ink-search__field">
                <input
                  id="ink-search"
                  type="search"
                  data-testid="menu-search"
                  className="ink-search__input"
                  placeholder="Pato, gyozas, maki de salmón…"
                  autoComplete="off"
                  enterKeyHint="search"
                  value={search.query}
                  onChange={(e) => search.setQuery(e.target.value)}
                />
                {search.active && (
                  <button type="button" className="ink-search__clear" onClick={() => search.setQuery("")}>
                    Borrar
                  </button>
                )}
              </div>
            </div>
          </div>
          {search.active ? (
            <SearchResults
              query={search.query}
              results={search.results}
              cartByItem={cartByItem}
              onBrowse={() => {
                search.setQuery("");
                goToAnchor("carta");
              }}
              {...rowProps}
            />
          ) : (
            PARTS.map((part) => (
              <div key={part.id} className="ink-part">
                <div className="ink-part__head">
                  <p className="ink-part__ordinal">{part.ordinal}</p>
                  <p className="ink-part__title">{part.title}</p>
                </div>
                {part.chapters.map((chapter) => {
                  const plate = PLATES[chapter.id];
                  const plateNumber = plate?.number;
                  const photo = plate ? inkPhotos[plate.photo] : undefined;
                  return (
                    <Fragment key={chapter.id}>
                      {plate && photo && (
                        <figure className="ink-plate">
                          <ShPhoto
                            photo={photo}
                            sizes="(min-width: 900px) 52vw, 92vw"
                            className="ink-plate__img ink-photo"
                          />
                          <figcaption className="ink-caption">
                            Lámina {plateNumber}. Imagen ilustrativa.
                          </figcaption>
                        </figure>
                      )}
                      <section
                        id={chapter.anchor}
                        data-chapter={chapter.id}
                        className="ink-chapter"
                        aria-labelledby={`${chapter.anchor}-t`}
                      >
                        <header className="ink-chapter__head">
                          <span className="ink-chapter__num" aria-hidden="true">
                            {chapter.number}
                          </span>
                          <h3
                            id={`${chapter.anchor}-t`}
                            className="ink-chapter__title"
                            tabIndex={-1}
                            data-anchor-focus
                          >
                            {chapter.title}
                          </h3>
                          {chapter.titleEn && (
                            <span className="ink-chapter__en" lang="en">
                              {chapter.titleEn}
                            </span>
                          )}
                          <span className="ink-chapter__count">{platosLabel(chapter.items.length)}</span>
                        </header>
                        <ul className="ink-rows">
                          {chapter.items.map((item) => (
                            <InkRow
                              key={item.id}
                              item={item}
                              cart={cartByItem.get(item.id) ?? EMPTY}
                              {...rowProps}
                            />
                          ))}
                        </ul>
                      </section>
                    </Fragment>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function SearchResults({
  query,
  results,
  cartByItem,
  onBrowse,
  onAdd,
  onIncrement,
  onDecrement,
}: {
  query: string;
  results: MenuItem[];
  cartByItem: Map<string, RowCartState>;
  onBrowse: () => void;
  onAdd: (item: MenuItem) => void;
  onIncrement: (key: string) => void;
  onDecrement: (key: string) => void;
}) {
  const q = query.trim();
  return (
    <section className="ink-results" aria-labelledby="ink-results-title">
      <h3 id="ink-results-title" className="ink-results__title" aria-live="polite">
        {results.length === 0
          ? `Sin resultados para «${q}»`
          : `${results.length} ${results.length === 1 ? "resultado" : "resultados"} para «${q}»`}
      </h3>
      {results.length === 0 ? (
        <div className="ink-results__empty">
          <p>Prueba con otra palabra, como «pollo», «nigiri» o «tallarines», o recorre la carta por capítulos.</p>
          <button type="button" className="ink-button ink-button--quiet" onClick={onBrowse}>
            Ver todos los capítulos
          </button>
        </div>
      ) : (
        <ul className="ink-rows">
          {results.map((item) => {
            const chapter = CHAPTER_BY_CATEGORY.get(item.categoryId);
            return (
              <InkRow
                key={item.id}
                item={item}
                cart={cartByItem.get(item.id) ?? EMPTY}
                chapter={chapter ? { number: chapter.number, title: chapter.title } : undefined}
                onAdd={onAdd}
                onIncrement={onIncrement}
                onDecrement={onDecrement}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}
