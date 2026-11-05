"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { QUOTE_ISSUE_TEXT } from "@/lib/commerce/messages";
import { formatMoney } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locale";
import { shangHaiRestaurant } from "@/data/shang-hai/restaurant";
import { useCart } from "@/hooks/shang-hai/useCart";
import { useDialog } from "@/hooks/shang-hai/useDialog";
import { useLocale } from "@/hooks/shang-hai/useLocale";
import { shangHaiCatalog } from "@/lib/shang-hai/catalog";
import { COMMON_TEXT } from "@/lib/shang-hai/i18n/common";
import { itemName, lineName, lineOptionsLabel } from "@/lib/shang-hai/menu-i18n";
import { storefrontRoutes } from "@/lib/shang-hai/storefronts";
import { scrollToId, useWokUI } from "./WokUI";
import { useWokText } from "./WokLanguage";

/** First catalog item per Spanish name, to word the "dropped on restore" notice. */
const ITEM_BY_NAME = new Map<string, (typeof shangHaiCatalog.catalog.items)[number]>();
for (const item of shangHaiCatalog.catalog.items) if (!ITEM_BY_NAME.has(item.name)) ITEM_BY_NAME.set(item.name, item);

/** The cart store reports dropped dishes by their Spanish name (or id): show them in this language. */
function droppedNames(names: string[], locale: Locale): string {
  return names
    .map((name) => {
      const item = ITEM_BY_NAME.get(name) ?? shangHaiCatalog.byId.get(name);
      return item ? itemName(item, locale) : name;
    })
    .join(", ");
}

const DESKTOP = "(min-width: 1024px)";
const subscribeMedia = (cb: () => void) => {
  const mq = window.matchMedia(DESKTOP);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
export function useIsDesktop() {
  return useSyncExternalStore(subscribeMedia, () => window.matchMedia(DESKTOP).matches, () => false);
}

function Odometer({ value }: { value: string | number }) {
  const reduce = useReducedMotion();
  return (
    <span className="relative inline-flex overflow-hidden align-bottom leading-none">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          className="inline-block"
          initial={reduce ? false : { y: "105%" }}
          animate={{ y: 0 }}
          exit={reduce ? { opacity: 0 } : { y: "-105%" }}
          transition={{ duration: reduce ? 0 : 0.34, ease: [0.2, 0.9, 0.15, 1] }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** The persistent cart key: a loud ticket block (desktop) or a full-width bar (mobile). */
export function CartDock() {
  const { itemCount, totalCents } = useCart();
  const { openCart, cartOpen } = useWokUI();
  const { locale } = useLocale();
  const t = useWokText();
  // Visible text stays first in the accessible name (WCAG 2.5.3 label in name).
  const suffix = t.cart.dockSuffix(itemCount);
  return (
    <>
      <button
        type="button"
        data-testid="cart-open"
        onClick={openCart}
        aria-haspopup="dialog"
        aria-expanded={cartOpen}
        className="fixed bottom-6 right-6 z-50 hidden min-w-[15rem] items-stretch bg-[var(--wok-orange)] text-[var(--wok-petrol)] shadow-[0_18px_40px_-18px_rgba(0,0,0,0.8)] transition-transform hover:-translate-y-0.5 active:scale-[0.98] lg:flex"
      >
        <span className="wok-cond-tight flex items-center border-r-2 border-dashed border-[rgba(16,30,36,0.45)] px-4 text-[1rem]">
          {t.cart.dockLabel}
        </span>
        <span className="flex flex-1 items-center justify-between gap-4 px-4 py-3">
          <span className="wok-display text-[2.6rem]">
            <Odometer value={itemCount} />
          </span>
          <span className="wok-display text-[1.75rem] wok-nums">
            <Odometer value={formatMoney(totalCents, locale)} />
          </span>
        </span>
        <span className="wok-sr">{suffix}</span>
      </button>

      {itemCount > 0 && (
        <button
          type="button"
          data-testid="cart-open"
          onClick={openCart}
          aria-haspopup="dialog"
          aria-expanded={cartOpen}
          className="fixed inset-x-0 bottom-0 z-50 flex h-[4.25rem] items-center justify-between gap-3 bg-[var(--wok-orange)] px-4 pb-[env(safe-area-inset-bottom)] text-[var(--wok-petrol)] lg:hidden"
        >
          <span className="wok-cond-tight text-[1.0625rem]">{t.cart.dockMobile}</span>
          <span className="flex items-center gap-3">
            <span className="wok-display grid h-9 min-w-9 place-items-center bg-[var(--wok-petrol)] px-2 text-[1.35rem] text-[var(--wok-orange)]">
              <Odometer value={itemCount} />
            </span>
            <span className="wok-display text-[1.9rem] wok-nums">
              <Odometer value={formatMoney(totalCents, locale)} />
            </span>
          </span>
          <span className="wok-sr">{suffix}</span>
        </button>
      )}
    </>
  );
}

function CloseX() {
  return (
    <span aria-hidden className="relative block size-4 before:absolute before:inset-x-0 before:top-1/2 before:h-[3px] before:-translate-y-1/2 before:rotate-45 before:bg-current after:absolute after:inset-x-0 after:top-1/2 after:h-[3px] after:-translate-y-1/2 after:-rotate-45 after:bg-current" />
  );
}

/** TU TICKET: a thermal-paper order ticket with every line editable. */
export function CartTicket() {
  const cart = useCart();
  const { cartOpen, closeCart } = useWokUI();
  const { locale } = useLocale();
  const t = useWokText();
  const common = COMMON_TEXT[locale];
  const reduce = useReducedMotion();
  const desktop = useIsDesktop();
  const ref = useDialog<HTMLDivElement>(cartOpen, closeCart);
  const { quote } = cart;
  const blocking = quote.issues.filter((i) => i.code !== "empty");
  const offset = desktop ? { x: "100%" } : { y: "100%" };

  return (
    <AnimatePresence>
      {cartOpen && (
        <div className="fixed inset-0 z-[90]">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-[rgba(8,15,18,0.78)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            onClick={closeCart}
          />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wok-ticket-title"
            data-testid="cart-panel"
            className={
              "wok-paper absolute flex flex-col " +
              (desktop
                ? "wok-perf-left inset-y-0 right-0 w-[min(30rem,100vw)] pl-3"
                : "wok-perf-top inset-x-0 bottom-0 top-3 pt-3")
            }
            initial={reduce ? { opacity: 0 } : offset}
            animate={reduce ? { opacity: 1 } : { x: 0, y: 0 }}
            exit={reduce ? { opacity: 0 } : offset}
            transition={{ duration: reduce ? 0 : 0.36, ease: [0.2, 0.9, 0.15, 1] }}
          >
            <div className="flex items-start justify-between gap-4 px-5 pt-4">
              <div>
                <h2 id="wok-ticket-title" className="wok-display text-[3.25rem] text-[var(--wok-petrol)]">
                  {t.cart.title}
                </h2>
                <p className="wok-cond mt-2 text-[0.75rem] text-[rgba(16,30,36,0.72)]">
                  Shang Hai / {common.pickup.title}
                </p>
              </div>
              <button
                type="button"
                onClick={closeCart}
                className="wok-cond -mr-2 flex h-11 items-center gap-2 px-2 text-[0.875rem]"
              >
                {t.cart.close} <CloseX />
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto overscroll-contain px-5">
              {cart.restoredDropped.length > 0 && (
                <div className="mb-4 border-2 border-[var(--wok-petrol)] p-3 text-[0.9375rem]" role="status">
                  <p>{t.cart.dropped(droppedNames(cart.restoredDropped, locale))}</p>
                  <button
                    type="button"
                    className="mt-2 font-semibold underline underline-offset-2"
                    onClick={cart.dismissRestoredNotice}
                  >
                    {t.cart.gotIt}
                  </button>
                </div>
              )}

              {cart.hydrated && quote.lines.length === 0 ? (
                <div className="border-t-2 border-dashed border-[rgba(16,30,36,0.32)] py-10">
                  <p className="wok-display text-[2.25rem]">{t.cart.emptyTitle}</p>
                  <p className="mt-3 max-w-[22rem] text-[1rem] text-[rgba(16,30,36,0.78)]">{t.cart.emptyText}</p>
                  <button
                    type="button"
                    className="wok-btn mt-6 bg-[var(--wok-petrol)] text-[var(--wok-white)]"
                    onClick={() => {
                      closeCart();
                      scrollToId("carta");
                    }}
                  >
                    {t.cart.seeMenu}
                  </button>
                </div>
              ) : (
                <ul className="border-t-2 border-dashed border-[rgba(16,30,36,0.32)]">
                  {quote.lines.map((line) => {
                    const name = lineName(line, locale);
                    const options = lineOptionsLabel(line, locale);
                    return (
                      <li
                        key={line.key}
                        data-testid={`cart-line-${line.itemId}`}
                        className="border-b-2 border-dashed border-[rgba(16,30,36,0.32)] py-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="wok-cond-tight text-[1.0625rem] leading-tight">{name}</p>
                            {options && (
                              <p className="mt-1 text-[0.875rem] text-[rgba(16,30,36,0.75)]">{options}</p>
                            )}
                            <p className="mt-1 text-[0.8125rem] text-[rgba(16,30,36,0.7)] wok-nums">
                              {t.cart.each(formatMoney(line.unitPriceCents, locale))}
                            </p>
                          </div>
                          <p className="wok-display shrink-0 text-[1.65rem] wok-nums">
                            {formatMoney(line.lineTotalCents, locale)}
                          </p>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="wok-paper-stepper" role="group" aria-label={t.cart.quantityOf(name)}>
                            <button
                              type="button"
                              data-testid="qty-dec"
                              aria-label={t.cart.removeOne(name)}
                              onClick={() => cart.decrement(line.key)}
                            >
                              <span className="wok-minus" aria-hidden />
                            </button>
                            <output data-testid="line-qty" className="wok-nums" aria-live="polite">
                              {line.quantity}
                            </output>
                            <button
                              type="button"
                              data-testid="qty-inc"
                              aria-label={t.cart.addOne(name)}
                              disabled={line.quantity >= cart.limits.maxQuantityPerLine}
                              className="disabled:opacity-35"
                              onClick={() => cart.increment(line.key)}
                            >
                              <span className="wok-plus" aria-hidden />
                            </button>
                          </div>
                          <button
                            type="button"
                            data-testid="line-remove"
                            onClick={() => cart.remove(line.key)}
                            className="wok-cond flex h-11 items-center px-2 text-[0.8125rem] text-[var(--wok-orange-deep)] underline decoration-2 underline-offset-4"
                          >
                            {t.cart.remove} <span className="wok-sr">{name}</span>
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {blocking.length > 0 && (
                <ul className="mt-4 space-y-1 text-[0.9375rem] font-semibold text-[var(--wok-orange-deep)]" role="alert">
                  {[...new Set(blocking.map((i) => QUOTE_ISSUE_TEXT[locale][i.code]))].map((msg) => (
                    <li key={msg}>{msg}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t-2 border-[var(--wok-petrol)] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
              <div className="flex items-end justify-between gap-4">
                <p className="wok-cond text-[0.875rem]">
                  {t.cart.total} <span className="wok-sr">{t.cart.totalSr}</span>
                  <span className="mt-1 block text-[0.75rem] normal-case tracking-normal text-[rgba(16,30,36,0.7)]">
                    {t.cart.items(quote.itemCount)}
                  </span>
                </p>
                <p data-testid="cart-total" className="wok-total text-[3.25rem]">
                  {formatMoney(quote.totalCents, locale)}
                </p>
              </div>
              <p className="mt-2 text-[0.875rem] text-[rgba(16,30,36,0.75)]">
                {t.cart.pickupAt(shangHaiRestaurant.address.value.street)} {common.pickup.timeAfterAcceptance}
              </p>
              {quote.payable ? (
                <Link
                  href={storefrontRoutes("wok-after-dark").checkout}
                  data-testid="checkout-start"
                  onClick={closeCart}
                  className="wok-btn wok-btn--hot mt-4 h-16 w-full text-[1.25rem]"
                >
                  {t.cart.checkout}
                </Link>
              ) : (
                <button type="button" disabled className="wok-btn wok-btn--hot mt-4 h-16 w-full text-[1.25rem]">
                  {t.cart.checkout}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
