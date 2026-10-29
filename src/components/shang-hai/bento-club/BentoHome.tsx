"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/hooks/shang-hai/useCart";
import { useMenuSearch } from "@/hooks/shang-hai/useMenuSearch";
import type { CartEvent } from "@/lib/commerce/cart-store";
import type { MenuItem, OptionSelections } from "@/lib/commerce/types";
import { shangHaiCatalog } from "@/lib/shang-hai/catalog";
import { CartContents } from "./CartContents";
import { MiniCart, TabBar, TopBar } from "./Chrome";
import { EntryTray } from "./Entry";
import { BentoFooter, InfoSection } from "./Info";
import { MenuBoard, type TileHandlers } from "./Menu";
import { CartSheet, OptionChooser } from "./Overlays";
import { DESKTOP_QUERY, scrollToId, useEvent, useMediaQuery } from "./hooks";

const REJECTION_COPY: Record<string, string> = {
  "quantity-limit": "Has llegado al máximo de unidades de este plato para un pedido online.",
  "order-limit": "Has llegado al máximo de unidades de un pedido online.",
  "line-limit": "El pedido ya tiene el máximo de platos distintos.",
};

function announcement(event: CartEvent | null, quantityOf: (id: string) => number): string {
  if (!event) return "";
  if (event.type === "added") {
    const name = shangHaiCatalog.byId.get(event.itemId)?.name ?? "Plato";
    return `Añadido: ${name}. Llevas ${quantityOf(event.itemId)} en tu pedido.`;
  }
  if (event.type === "rejected") {
    return REJECTION_COPY[event.error] ?? "No se ha podido añadir este plato.";
  }
  if (event.type === "removed") return "Plato quitado de tu pedido.";
  return "";
}

/** BENTO CLUB home: entry tray, the whole carta, information, and the order UI. */
export function BentoHome() {
  const cart = useCart();
  const search = useMenuSearch();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [chooser, setChooser] = useState<MenuItem | null>(null);
  const [inMenu, setInMenu] = useState(false);
  const topSearchRef = useRef<HTMLInputElement>(null);
  const menuSearchRef = useRef<HTMLInputElement>(null);
  const wasSearching = useRef(false);

  const count = cart.hydrated ? cart.itemCount : 0;

  // Tile handlers stay referentially stable so 208 memoised tiles don't re-render.
  const onAdd = useEvent((item: MenuItem) => cart.add(item).ok);
  const onChoose = useEvent((item: MenuItem) => setChooser(item));
  const onInc = useEvent((key: string) => cart.increment(key));
  const onDec = useEvent((key: string) => cart.decrement(key));
  const handlers: TileHandlers = useMemo(
    () => ({ onAdd, onChoose, onInc, onDec }),
    [onAdd, onChoose, onInc, onDec],
  );

  // Starting a search swaps the 24 boxes for the results: bring the results into view
  // (from the desktop top bar, or from far down the carta on mobile).
  useEffect(() => {
    const searching = search.active;
    if (searching && !wasSearching.current) {
      const carta = document.getElementById("carta");
      const top = carta?.getBoundingClientRect().top ?? 0;
      if (carta && (top < -4 || top > window.innerHeight * 0.6)) {
        carta.scrollIntoView({ behavior: "instant", block: "start" });
      }
    }
    wasSearching.current = searching;
  }, [search.active]);

  // Which tab is "current" on mobile: the carta once it reaches the top of the screen.
  useEffect(() => {
    const carta = document.getElementById("carta");
    if (!carta) return;
    const io = new IntersectionObserver(
      ([entry]) => setInMenu(entry.isIntersecting || entry.boundingClientRect.top < 0),
      { rootMargin: "0px 0px -70% 0px" },
    );
    io.observe(carta);
    return () => io.disconnect();
  }, []);

  function focusSearch() {
    if (isDesktop) {
      topSearchRef.current?.focus();
      return;
    }
    const carta = document.getElementById("carta");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    carta?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    menuSearchRef.current?.focus({ preventScroll: true });
  }

  function openCart() {
    if (isDesktop) {
      document.getElementById("bc-cart-title")?.focus();
      return;
    }
    setSheetOpen(true);
  }

  function confirmChoice(item: MenuItem, selections: OptionSelections) {
    const result = cart.add(item, selections);
    if (result.ok) setChooser(null);
  }

  return (
    <>
      <TopBar
        query={search.query}
        setQuery={search.setQuery}
        inputRef={topSearchRef}
        count={count}
        onCart={openCart}
      />
      <div className="bc-frame">
        <main id="bc-main" className="bc-page">
          <EntryTray onSearch={focusSearch} />
          <MenuBoard
            query={search.query}
            setQuery={search.setQuery}
            results={search.results}
            searching={search.active}
            lines={cart.lines}
            max={cart.limits.maxQuantityPerLine}
            handlers={handlers}
            menubarSearchRef={menuSearchRef}
            isDesktop={isDesktop}
          />
          <InfoSection />
          <BentoFooter />
          <p className="bc-sr" role="status" aria-live="polite">
            {announcement(cart.lastEvent, cart.quantityOf)}
          </p>
        </main>
        <aside className="bc-sidebar" aria-label="Tu pedido">
          {isDesktop && (
            <div className="bc-sidebar__inner" data-testid="cart-panel">
              <div className="bc-sidebar__lid" aria-hidden />
              <CartContents variant="sidebar" onBrowse={() => scrollToId("carta")} />
            </div>
          )}
        </aside>
      </div>

      {!isDesktop && (
        <>
          <MiniCart count={count} totalCents={cart.totalCents} onOpen={() => setSheetOpen(true)} />
          <TabBar
            count={count}
            current={inMenu ? "carta" : "inicio"}
            onHome={() =>
              window.scrollTo({
                top: 0,
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? "auto"
                  : "smooth",
              })
            }
            onMenu={() => scrollToId("carta")}
            onSearch={focusSearch}
            onCart={() => setSheetOpen(true)}
          />
        </>
      )}

      <CartSheet
        open={sheetOpen && !isDesktop}
        onClose={() => setSheetOpen(false)}
        onBrowse={() => scrollToId("carta")}
      />
      <OptionChooser item={chooser} onClose={() => setChooser(null)} onConfirm={confirmChoice} />
    </>
  );
}
