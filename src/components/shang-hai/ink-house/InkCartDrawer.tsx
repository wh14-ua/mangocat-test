"use client";

import Link from "next/link";
import { useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCart } from "@/hooks/shang-hai/useCart";
import { useDialog } from "@/hooks/shang-hai/useDialog";
import { useLocale } from "@/hooks/shang-hai/useLocale";
import { QUOTE_ISSUE_TEXT } from "@/lib/commerce/messages";
import { formatMoney } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locale";
import { shangHaiRestaurant } from "@/data/shang-hai/restaurant";
import { shangHaiCatalog } from "@/lib/shang-hai/catalog";
import { COMMON_TEXT } from "@/lib/shang-hai/i18n/common";
import { INK_TEXT } from "@/lib/shang-hai/i18n/ink-house";
import { itemName, lineName, lineOptionsLabel } from "@/lib/shang-hai/menu-i18n";
import { storefrontRoutes } from "@/lib/shang-hai/storefronts";
import { Seal } from "./Seal";
import { useInkUI } from "./InkUI";
import { goToAnchor } from "./InkHeader";

const routes = storefrontRoutes("ink-house");

/** Line keys of option items contain | = ; + — keep test ids readable and unique. */
export function lineTestId(key: string): string {
  return `cart-line-${key.replace(/[|=;+]/g, "-")}`;
}

const itemByName = new Map(shangHaiCatalog.catalog.items.map((i) => [i.name, i]));

/** Dishes dropped from a saved cart are reported by their Spanish name (or id). */
function droppedName(name: string, locale: Locale): string {
  const item = shangHaiCatalog.byId.get(name) ?? itemByName.get(name);
  return item ? itemName(item, locale) : name;
}

/**
 * "Tu pedido": a paper comanda that slides in from the right (a full-width sheet on
 * phones). Lines are priced from the current catalog through the shared quote.
 */
export function InkCartDrawer() {
  const ui = useInkUI();
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const ref = useDialog<HTMLDivElement>(ui.cartOpen, ui.closeCart, { initialFocus: closeRef });

  return (
    <AnimatePresence>
      {ui.cartOpen && (
        <div className="ink-layer" key="cart">
          <motion.div
            className="ink-scrim"
            aria-hidden="true"
            onClick={ui.closeCart}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.3 }}
          />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ink-cart-title"
            data-testid="cart-panel"
            className="ink-drawer"
            initial={reduce ? { opacity: 0 } : { x: "100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "100%" }}
            transition={{ duration: reduce ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            <CartContents closeRef={closeRef} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function CartContents({ closeRef }: { closeRef: React.RefObject<HTMLButtonElement | null> }) {
  const ui = useInkUI();
  const cart = useCart();
  const { locale } = useLocale();
  const ink = INK_TEXT[locale];
  const t = ink.cart;
  const row = ink.row;
  const { quote } = cart;
  const empty = cart.lines.length === 0;

  return (
    <div className="ink-drawer__paper">
      <div className="ink-drawer__head">
        <Seal className="ink-drawer__seal" />
        <h2 id="ink-cart-title" className="ink-drawer__title">
          {t.title}
        </h2>
        <button ref={closeRef} type="button" className="ink-close" onClick={ui.closeCart}>
          {t.close}
        </button>
      </div>

      <div className="ink-drawer__scroll">
        {cart.restoredDropped.length > 0 && (
          <div className="ink-note" role="status">
            <p>{t.dropped(cart.restoredDropped.map((n) => droppedName(n, locale)).join(", "))}</p>
            <button type="button" className="ink-text-button" onClick={cart.dismissRestoredNotice}>
              {t.gotIt}
            </button>
          </div>
        )}

        {empty ? (
          <div className="ink-drawer__empty">
            <p className="ink-drawer__empty-title">{t.emptyTitle}</p>
            <p>{t.emptyText}</p>
            <button
              type="button"
              className="ink-button ink-button--ink"
              onClick={() => {
                ui.closeCart();
                goToAnchor("carta");
              }}
            >
              {t.goToMenu}
            </button>
          </div>
        ) : (
          <ol className="ink-lines">
            {quote.lines.map((line) => {
              const name = lineName(line, locale);
              const optionsLabel = lineOptionsLabel(line, locale);
              return (
                <li key={line.key} className="ink-line" data-testid={lineTestId(line.key)}>
                  <div className="ink-line__text">
                    <p className="ink-line__name">{name}</p>
                    {optionsLabel && <p className="ink-line__meta">{optionsLabel}</p>}
                    <p className="ink-line__meta">{t.each(formatMoney(line.unitPriceCents, locale))}</p>
                  </div>
                  <p className="ink-line__total">{formatMoney(line.lineTotalCents, locale)}</p>
                  <div className="ink-line__controls">
                    <div className="ink-stepper" role="group" aria-label={row.quantityOf(name)}>
                      <button
                        type="button"
                        className="ink-stepper__btn"
                        data-testid="qty-dec"
                        aria-label={row.removeOne(name)}
                        onClick={() => cart.decrement(line.key)}
                      >
                        <span aria-hidden="true">−</span>
                      </button>
                      <span className="ink-stepper__qty" data-testid="line-qty" aria-live="polite">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        className="ink-stepper__btn"
                        data-testid="qty-inc"
                        aria-label={row.addOne(name)}
                        disabled={line.quantity >= cart.limits.maxQuantityPerLine}
                        onClick={() => cart.increment(line.key)}
                      >
                        <span aria-hidden="true">+</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      className="ink-text-button"
                      data-testid="line-remove"
                      aria-label={t.removeLine(name)}
                      onClick={() => cart.remove(line.key)}
                    >
                      {t.remove}
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {!empty && (
        <div className="ink-drawer__foot">
          {quote.issues.length > 0 && !quote.payable && (
            <p className="ink-error-text" role="alert">
              {QUOTE_ISSUE_TEXT[locale][quote.issues[0].code]}
            </p>
          )}
          <dl className="ink-total">
            <dt>{ink.total}</dt>
            <dd data-testid="cart-total">{formatMoney(quote.totalCents, locale)}</dd>
          </dl>
          <p className="ink-drawer__pickup">
            {t.pickupAt(shangHaiRestaurant.address.value.street)} {COMMON_TEXT[locale].pickup.timeAfterAcceptance}
          </p>
          <Link
            href={routes.checkout}
            data-testid="checkout-start"
            className="ink-button ink-button--lacquer ink-button--block"
            aria-disabled={!quote.payable || undefined}
            onClick={(e) => {
              if (!quote.payable) {
                e.preventDefault();
                return;
              }
              ui.closeCart();
            }}
          >
            {t.continue}
          </Link>
        </div>
      )}
    </div>
  );
}
