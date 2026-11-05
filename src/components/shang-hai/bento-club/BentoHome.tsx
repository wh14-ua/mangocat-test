"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/hooks/shang-hai/useCart";
import { useMenuSearch } from "@/hooks/shang-hai/useMenuSearch";
import type { CartEvent } from "@/lib/commerce/cart-store";
import type { MenuItem, OptionSelections } from "@/lib/commerce/types";
import type { Locale } from "@/lib/i18n/locale";
import type { BentoText } from "@/lib/shang-hai/i18n/bento-club";
import { shangHaiCatalog } from "@/lib/shang-hai/catalog";
import { itemName } from "@/lib/shang-hai/menu-i18n";
import { CartContents } from "./CartContents";
import { BentoLanguageSwitch, MiniCart, TabBar, TopBar } from "./Chrome";
import { EntryTray } from "./Entry";
import { BentoFooter, InfoSection } from "./Info";
import { MenuBoard, type TileHandlers } from "./Menu";
import { CartSheet, OptionChooser } from "./Overlays";
import { DESKTOP_QUERY, scrollToId, useBento, useDocumentTitle, useEvent, useMediaQuery } from "./hooks";

function announcement(
  event: CartEvent | null,
  quantityOf: (id: string) => number,
  t: BentoText,
  locale: Locale,
): string {
  if (!event) return "";
  if (event.type === "added") {
    const item = shangHaiCatalog.byId.get(event.itemId);
    return t.live.added(item ? itemName(item, locale) : t.live.dish, quantityOf(event.itemId));
  }
  if (event.type === "rejected") {
    if (event.error === "quantity-limit") return t.live.quantityLimit;
    if (event.error === "order-limit") return t.live.orderLimit;
    if (event.error === "line-limit") return t.live.lineLimit;
    return t.live.notAdded;
  }
  if (event.type === "removed") return t.live.removed;
  return "";
}

/** BENTO CLUB home: entry tray, the whole carta, information, and the order UI. */
export function BentoHome() {
  const { locale, t } = useBento();
  useDocumentTitle(t.meta.home);
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
          {/* Phones and tablets have no top bar: the language sits at the top of the page. */}
          <div className="bc-langbar">
            <BentoLanguageSwitch />
          </div>
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
            {announcement(cart.lastEvent, cart.quantityOf, t, locale)}
          </p>
        </main>
        <aside className="bc-sidebar" aria-label={t.cart.title}>
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
