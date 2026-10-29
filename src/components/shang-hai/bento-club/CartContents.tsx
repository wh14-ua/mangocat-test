"use client";

import Link from "next/link";
import { X } from "@phosphor-icons/react/dist/ssr";
import { useCart } from "@/hooks/shang-hai/useCart";
import { formatCents } from "@/lib/commerce/money";
import { QUOTE_ISSUE_COPY } from "@/lib/commerce/pricing";
import { shangHaiCatalog } from "@/lib/shang-hai/catalog";
import { storefrontRoutes } from "@/lib/shang-hai/storefronts";
import { EmptyTrayArt } from "./Graphics";
import { Stepper } from "./ProductTile";

const routes = storefrontRoutes("bento-club");

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
            Tu pedido
          </h2>
          <p className="bc-cart__sub">
            {empty
              ? "Recogida en el local"
              : `${quote.itemCount} ${quote.itemCount === 1 ? "producto" : "productos"} · recogida en el local`}
          </p>
        </div>
        {variant === "sheet" && (
          <button type="button" className="bc-iconbtn" onClick={onClose} aria-label="Cerrar tu pedido">
            <X size={22} weight="bold" aria-hidden />
          </button>
        )}
      </div>

      {cart.restoredDropped.length > 0 && (
        <div className="bc-cart__notice" role="status">
          <p>
            Hemos quitado de tu pedido guardado lo que ya no está disponible:{" "}
            {cart.restoredDropped.join(", ")}.
          </p>
          <button type="button" onClick={cart.dismissRestoredNotice}>
            Entendido
          </button>
        </div>
      )}

      {empty ? (
        <div className="bc-cart__empty">
          <EmptyTrayArt />
          <strong>Tu bandeja está vacía</strong>
          <p>Toca el botón + de cualquier plato para empezar tu pedido.</p>
          {onBrowse && (
            <button type="button" className="bc-linkbtn" onClick={onBrowse}>
              Ver la carta
            </button>
          )}
        </div>
      ) : (
        <ul className="bc-cart__list" aria-label="Productos de tu pedido">
          {quote.lines.map((line) => (
            <li key={line.key} className="bc-line" data-testid={`cart-line-${line.itemId}`}>
              <div>
                <p className="bc-line__name">{line.name}</p>
                {line.optionsLabel && <p className="bc-line__meta">{line.optionsLabel}</p>}
                <p className="bc-line__meta">{formatCents(line.unitPriceCents)} / ud.</p>
              </div>
              <p className="bc-line__total">{formatCents(line.lineTotalCents)}</p>
              <div className="bc-line__row">
                <Stepper
                  name={line.name}
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
                  aria-label={`Quitar ${line.name} del pedido`}
                  onClick={() => cart.remove(line.key)}
                >
                  Quitar
                </button>
              </div>
            </li>
          ))}
          {stale.map((line) => (
            <li key={line.key} className="bc-line" data-testid={`cart-line-${line.itemId}`}>
              <div>
                <p className="bc-line__name">
                  {shangHaiCatalog.byId.get(line.itemId)?.name ?? "Producto"}
                </p>
                <p className="bc-line__meta">No se puede pedir ahora mismo</p>
              </div>
              <div className="bc-line__row">
                <span />
                <button
                  type="button"
                  className="bc-line__remove"
                  data-testid="line-remove"
                  onClick={() => cart.remove(line.key)}
                >
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!empty && (
        <div className="bc-cart__foot">
          <div className="bc-sums">
            <div className="bc-sums__row">
              <span>Subtotal</span>
              <span className="bc-nums">{formatCents(quote.subtotalCents)}</span>
            </div>
            <div className="bc-sums__row">
              <span>Recogida en el local</span>
              <span>Sin coste</span>
            </div>
            <div className="bc-sums__total">
              <span>Total</span>
              <strong data-testid="cart-total">{formatCents(quote.totalCents)}</strong>
            </div>
          </div>
          {blocking.length > 0 && (
            <p className="bc-fine" role="status">
              {QUOTE_ISSUE_COPY[blocking[0].code]}
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
            Hacer el pedido
          </Link>
          <p className="bc-fine">El restaurante te confirmará la hora de recogida.</p>
        </div>
      )}
    </div>
  );
}
