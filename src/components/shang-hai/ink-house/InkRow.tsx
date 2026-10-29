"use client";

import { memo } from "react";
import { getOrderability, NOT_ORDERABLE_COPY } from "@/lib/commerce/catalog";
import { formatCents } from "@/lib/commerce/money";
import type { MenuItem } from "@/lib/commerce/types";

export type RowCartState = { quantity: number; lineKey: string | null };

type RowProps = {
  item: MenuItem;
  cart: RowCartState;
  /** Shown in search results, where rows from different chapters are mixed. */
  chapter?: { number: string; title: string };
  onAdd: (item: MenuItem) => void;
  onIncrement: (key: string) => void;
  onDecrement: (key: string) => void;
};

function optionSummary(item: MenuItem): string | null {
  const option = item.options?.[0];
  if (!option) return null;
  const names = option.choices.map((c) => c.name.toLowerCase());
  return `A elegir: ${names.slice(0, -1).join(", ")}${names.length > 1 ? " o " : ""}${names.at(-1)}.`;
}

/**
 * One dish, set like a line in a printed menu: name and piece count, a quiet second
 * line, the price aligned on tabular figures and a small seal-like add control that
 * becomes an inline stepper once the dish is in the order.
 */
export const InkRow = memo(function InkRow({
  item,
  cart,
  chapter,
  onAdd,
  onIncrement,
  onDecrement,
}: RowProps) {
  const orderability = getOrderability(item);
  const spicy = item.dietaryTags?.includes("spicy");
  const options = optionSummary(item);
  const inCart = cart.quantity > 0;

  return (
    <li className="ink-row" data-in-cart={inCart ? "" : undefined}>
      <div className="ink-row__text">
        {chapter && (
          <p className="ink-row__chapter">
            <span className="ink-num">{chapter.number}</span> {chapter.title}
          </p>
        )}
        <p className="ink-row__name">
          <span className="ink-row__title">{item.name}</span>
          {item.pieces && (
            <span className="ink-row__pieces">
              {item.pieces.count} {item.pieces.unit}
            </span>
          )}
          {spicy && <span className="ink-row__tag">Picante</span>}
        </p>
        {item.description ? (
          <p className="ink-row__desc">{item.description}</p>
        ) : item.nameEn ? (
          <p className="ink-row__desc ink-row__desc--en" lang="en">
            {item.nameEn.charAt(0).toUpperCase() + item.nameEn.slice(1)}
          </p>
        ) : null}
        {options && <p className="ink-row__desc">{options}</p>}
      </div>

      <div className="ink-row__side">
        {orderability.orderable ? (
          <>
            <p className="ink-row__price">{formatCents(item.priceCents as number)}</p>
            {inCart && cart.lineKey ? (
              <div className="ink-stepper" role="group" aria-label={`Cantidad de ${item.name}`}>
                <button
                  type="button"
                  className="ink-stepper__btn"
                  aria-label={`Quitar una unidad de ${item.name}`}
                  onClick={() => onDecrement(cart.lineKey as string)}
                >
                  <span aria-hidden="true">−</span>
                </button>
                <span className="ink-stepper__qty" aria-live="polite">
                  {cart.quantity}
                </span>
                <button
                  type="button"
                  className="ink-stepper__btn"
                  aria-label={`Añadir una unidad de ${item.name}`}
                  onClick={() => onIncrement(cart.lineKey as string)}
                >
                  <span aria-hidden="true">+</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="ink-add"
                data-testid={`add-${item.id}`}
                aria-label={
                  item.options?.length
                    ? `Elegir opción y añadir ${item.name}`
                    : `Añadir ${item.name}`
                }
                onClick={() => onAdd(item)}
              >
                <span aria-hidden="true">+</span>
                {inCart && (
                  <span className="ink-add__count" aria-hidden="true">
                    {cart.quantity}
                  </span>
                )}
              </button>
            )}
          </>
        ) : (
          <p className="ink-row__pending">{NOT_ORDERABLE_COPY[orderability.reason]}</p>
        )}
      </div>
    </li>
  );
});
