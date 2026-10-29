"use client";

import Link from "next/link";
import { useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCart } from "@/hooks/shang-hai/useCart";
import { useDialog } from "@/hooks/shang-hai/useDialog";
import { formatCents } from "@/lib/commerce/money";
import { QUOTE_ISSUE_COPY } from "@/lib/commerce/pricing";
import { shangHaiRestaurant } from "@/data/shang-hai/restaurant";
import { storefrontRoutes } from "@/lib/shang-hai/storefronts";
import { Seal } from "./Seal";
import { useInkUI } from "./InkUI";
import { goToAnchor } from "./InkHeader";

const routes = storefrontRoutes("ink-house");

/** Line keys of option items contain | = ; + — keep test ids readable and unique. */
export function lineTestId(key: string): string {
  return `cart-line-${key.replace(/[|=;+]/g, "-")}`;
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
  const { quote } = cart;
  const empty = cart.lines.length === 0;

  return (
    <div className="ink-drawer__paper">
      <div className="ink-drawer__head">
        <Seal className="ink-drawer__seal" />
        <h2 id="ink-cart-title" className="ink-drawer__title">
          Tu pedido
        </h2>
        <button ref={closeRef} type="button" className="ink-close" onClick={ui.closeCart}>
          Cerrar
        </button>
      </div>

      <div className="ink-drawer__scroll">
        {cart.restoredDropped.length > 0 && (
          <div className="ink-note" role="status">
            <p>
              Hemos retirado de tu pedido lo que ya no está disponible:{" "}
              {cart.restoredDropped.join(", ")}.
            </p>
            <button type="button" className="ink-text-button" onClick={cart.dismissRestoredNotice}>
              Entendido
            </button>
          </div>
        )}

        {empty ? (
          <div className="ink-drawer__empty">
            <p className="ink-drawer__empty-title">Todavía no has elegido nada.</p>
            <p>Recorre la carta y añade platos con el sello «+». Aquí verás tu pedido.</p>
            <button
              type="button"
              className="ink-button ink-button--ink"
              onClick={() => {
                ui.closeCart();
                goToAnchor("carta");
              }}
            >
              Ir a la carta
            </button>
          </div>
        ) : (
          <ol className="ink-lines">
            {quote.lines.map((line) => (
              <li key={line.key} className="ink-line" data-testid={lineTestId(line.key)}>
                <div className="ink-line__text">
                  <p className="ink-line__name">{line.name}</p>
                  {line.optionsLabel && <p className="ink-line__meta">{line.optionsLabel}</p>}
                  <p className="ink-line__meta">{formatCents(line.unitPriceCents)} la unidad</p>
                </div>
                <p className="ink-line__total">{formatCents(line.lineTotalCents)}</p>
                <div className="ink-line__controls">
                  <div className="ink-stepper" role="group" aria-label={`Cantidad de ${line.name}`}>
                    <button
                      type="button"
                      className="ink-stepper__btn"
                      data-testid="qty-dec"
                      aria-label={`Quitar una unidad de ${line.name}`}
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
                      aria-label={`Añadir una unidad de ${line.name}`}
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
                    aria-label={`Eliminar ${line.name} del pedido`}
                    onClick={() => cart.remove(line.key)}
                  >
                    Quitar
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {!empty && (
        <div className="ink-drawer__foot">
          {quote.issues.length > 0 && !quote.payable && (
            <p className="ink-error-text" role="alert">
              {QUOTE_ISSUE_COPY[quote.issues[0].code]}
            </p>
          )}
          <dl className="ink-total">
            <dt>Total</dt>
            <dd data-testid="cart-total">{formatCents(quote.totalCents)}</dd>
          </dl>
          <p className="ink-drawer__pickup">
            Para recoger en {shangHaiRestaurant.address.value.street}. El restaurante te confirmará la
            hora de recogida.
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
            Continuar con el pedido
          </Link>
        </div>
      )}
    </div>
  );
}
