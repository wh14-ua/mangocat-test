"use client";

import Link from "next/link";
import { X } from "@phosphor-icons/react/dist/ssr";
import { useCart } from "@/hooks/shang-hai/useCart";
import { QUOTE_ISSUE_TEXT } from "@/lib/commerce/messages";
import { formatMoney } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locale";
import { shangHaiCatalog } from "@/lib/shang-hai/catalog";
import { itemName, lineName, lineOptionsLabel } from "@/lib/shang-hai/menu-i18n";
import { storefrontRoutes } from "@/lib/shang-hai/storefronts";
import { EmptyTrayArt } from "./Graphics";
import { useBento } from "./hooks";
import { Stepper } from "./ProductTile";

const routes = storefrontRoutes("bento-club");

/** The cart reports dropped dishes by their (Spanish) catalog name: show them in the visitor's language. */
function droppedName(name: string, locale: Locale): string {
  const item = shangHaiCatalog.catalog.items.find((i) => i.name === name || i.id === name);
  return item ? itemName(item, locale) : name;
}

/**
 * The order, as shown in the mobile bottom sheet and in the desktop sidebar. Only one
 * of the two is mounted at a time, so ids and test ids stay unique.
 */
export function CartContents({
  variant,
  onClose,
  onBrowse,
}: {
  variant: "sheet" | "sidebar";
  onClose?: () => void;
  onBrowse?: () => void;
}) {
  const cart = useCart();
  const { locale, t, c } = useBento();
  const { quote } = cart;
  const empty = cart.lines.length === 0;
  const priced = new Set(quote.lines.map((l) => l.key));
  const stale = cart.lines.filter((l) => !priced.has(l.key));
  const blocking = quote.issues.filter((i) => i.code !== "empty");

  return (
    <div className="bc-cart">
      <div className="bc-cart__head">
        <div>
          <h2 id="bc-cart-title" className="bc-cart__title" tabIndex={-1}>
            {t.cart.title}
          </h2>
          <p className="bc-cart__sub">{empty ? c.pickup.title : t.cart.summary(quote.itemCount)}</p>
        </div>
        {variant === "sheet" && (
          <button type="button" className="bc-iconbtn" onClick={onClose} aria-label={t.cart.close}>
            <X size={22} weight="bold" aria-hidden />
          </button>
        )}
      </div>

      {cart.restoredDropped.length > 0 && (
        <div className="bc-cart__notice" role="status">
          <p>{t.cart.restored(cart.restoredDropped.map((n) => droppedName(n, locale)).join(", "))}</p>
          <button type="button" onClick={cart.dismissRestoredNotice}>
            {t.cart.understood}
          </button>
        </div>
      )}

      {empty ? (
        <div className="bc-cart__empty">
          <EmptyTrayArt />
          <strong>{t.cart.emptyTitle}</strong>
          <p>{t.cart.emptyText}</p>
          {onBrowse && (
            <button type="button" className="bc-linkbtn" onClick={onBrowse}>
              {t.cart.browse}
            </button>
          )}
        </div>
      ) : (
        <ul className="bc-cart__list" aria-label={t.cart.list}>
          {quote.lines.map((line) => {
            const name = lineName(line, locale);
            const options = lineOptionsLabel(line, locale);
            return (
              <li key={line.key} className="bc-line" data-testid={`cart-line-${line.itemId}`}>
                <div>
                  <p className="bc-line__name">{name}</p>
                  {options && <p className="bc-line__meta">{options}</p>}
                  <p className="bc-line__meta">{t.cart.each(formatMoney(line.unitPriceCents, locale))}</p>
                </div>
                <p className="bc-line__total">{formatMoney(line.lineTotalCents, locale)}</p>
                <div className="bc-line__row">
                  <Stepper
                    name={name}
                    quantity={line.quantity}
                    max={cart.limits.maxQuantityPerLine}
                    onInc={() => cart.increment(line.key)}
                    onDec={() => cart.decrement(line.key)}
                    withTestIds
                  />
                  <button
                    type="button"
                    className="bc-line__remove"
                    data-testid="line-remove"
                    aria-label={t.tile.removeAll(name)}
                    onClick={() => cart.remove(line.key)}
                  >
                    {t.cart.remove}
                  </button>
                </div>
              </li>
            );
          })}
          {stale.map((line) => {
            const item = shangHaiCatalog.byId.get(line.itemId);
            return (
              <li key={line.key} className="bc-line" data-testid={`cart-line-${line.itemId}`}>
                <div>
                  <p className="bc-line__name">{item ? itemName(item, locale) : t.cart.item}</p>
                  <p className="bc-line__meta">{t.cart.unavailable}</p>
                </div>
                <div className="bc-line__row">
                  <span />
                  <button
                    type="button"
                    className="bc-line__remove"
                    data-testid="line-remove"
                    onClick={() => cart.remove(line.key)}
                  >
                    {t.cart.remove}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!empty && (
        <div className="bc-cart__foot">
          <div className="bc-sums">
            <div className="bc-sums__row">
              <span>{t.cart.subtotal}</span>
              <span className="bc-nums">{formatMoney(quote.subtotalCents, locale)}</span>
            </div>
            <div className="bc-sums__row">
              <span>{c.pickup.title}</span>
              <span>{t.cart.noCharge}</span>
            </div>
            <div className="bc-sums__total">
              <span>{t.cart.total}</span>
              <strong data-testid="cart-total">{formatMoney(quote.totalCents, locale)}</strong>
            </div>
          </div>
          {blocking.length > 0 && (
            <p className="bc-fine" role="status">
              {QUOTE_ISSUE_TEXT[locale][blocking[0].code]}
            </p>
          )}
          <Link
            href={routes.checkout}
            className="bc-primary"
            data-testid="checkout-start"
            aria-disabled={!quote.payable || undefined}
            onClick={(e) => {
              if (!quote.payable) e.preventDefault();
            }}
          >
            {t.cart.checkout}
          </Link>
          <p className="bc-fine">{c.pickup.timeAfterAcceptance}</p>
        </div>
      )}
    </div>
  );
}
