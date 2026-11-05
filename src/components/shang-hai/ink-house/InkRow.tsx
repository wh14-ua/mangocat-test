"use client";

import { memo } from "react";
import { getOrderability } from "@/lib/commerce/catalog";
import { NOT_ORDERABLE_TEXT } from "@/lib/commerce/messages";
import type { MenuItem } from "@/lib/commerce/types";
import { formatMoney } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locale";
import { INK_TEXT } from "@/lib/shang-hai/i18n/ink-house";
import { choiceName, itemAltName, itemDescription, itemName, itemPieces } from "@/lib/shang-hai/menu-i18n";
import { useLocale } from "@/hooks/shang-hai/useLocale";
import { DishPhoto, useDishPhotos } from "@/components/shang-hai/shared/DishPhotos";
import { chapterTitle, type Chapter } from "./chapters";

export type RowCartState = { quantity: number; lineKey: string | null };

type RowProps = {
  item: MenuItem;
  cart: RowCartState;
  /** Shown in search results, where rows from different chapters are mixed. */
  chapter?: Chapter;
  onAdd: (item: MenuItem) => void;
  onIncrement: (key: string) => void;
  onDecrement: (key: string) => void;
};

function optionSummary(item: MenuItem, locale: Locale): string | null {
  const option = item.options?.[0];
  if (!option) return null;
  return INK_TEXT[locale].row.options(option.choices.map((c) => choiceName(c, locale).toLowerCase()));
}

/**
 * The quiet second line: the description or, for dishes without one that the restaurant
 * also named in English, the name in the other language (English under Spanish, Spanish
 * under English: handy when talking to the staff).
 */
function secondLine(item: MenuItem, locale: Locale): { text: string; lang?: Locale } | null {
  if (item.description) {
    const text = itemDescription(item, locale);
    return text ? { text } : null;
  }
  if (!item.nameEn) return null;
  const other = itemAltName(item, locale);
  if (!other) return null;
  return { text: other.charAt(0).toUpperCase() + other.slice(1), lang: locale === "es" ? "en" : "es" };
}

/**
 * One dish, set like a line in a printed menu: name and piece count, a quiet second
 * line, the price aligned on tabular figures and a small seal-like add control that
 * becomes an inline stepper once the dish is in the order. With dish photos switched on
 * (?fotos=1), a dish that has one gets a small plate tipped in at the start of the row;
 * every other row stays exactly as printed.
 */
export const InkRow = memo(function InkRow({
  item,
  cart,
  chapter,
  onAdd,
  onIncrement,
  onDecrement,
}: RowProps) {
  const { locale } = useLocale();
  const t = INK_TEXT[locale].row;
  const photo = useDishPhotos().photoFor(item.id);
  const orderability = getOrderability(item);
  const spicy = item.dietaryTags?.includes("spicy");
  const options = optionSummary(item, locale);
  const second = secondLine(item, locale);
  const name = itemName(item, locale);
  const pieces = itemPieces(item, locale);
  const inCart = cart.quantity > 0;

  return (
    <li className="ink-row" data-in-cart={inCart ? "" : undefined} data-photo={photo ? "" : undefined}>
      {photo && (
        <DishPhoto
          photo={photo}
          decorative
          sizes="(min-width: 640px) 120px, 84px"
          className="ink-row__plate"
          imgClassName="ink-row__plate-img"
          labelClassName="ink-row__plate-label"
        />
      )}
      <div className="ink-row__text">
        {chapter && (
          <p className="ink-row__chapter">
            <span className="ink-num">{chapter.number}</span> {chapterTitle(chapter, locale)}
          </p>
        )}
        <p className="ink-row__name">
          <span className="ink-row__title">{name}</span>
          {pieces && <span className="ink-row__pieces">{pieces}</span>}
          {spicy && <span className="ink-row__tag">{t.spicy}</span>}
        </p>
        {second &&
          (second.lang ? (
            <p className="ink-row__desc ink-row__desc--en" lang={second.lang}>
              {second.text}
            </p>
          ) : (
            <p className="ink-row__desc">{second.text}</p>
          ))}
        {options && <p className="ink-row__desc">{options}</p>}
      </div>

      <div className="ink-row__side">
        {orderability.orderable ? (
          <>
            <p className="ink-row__price">{formatMoney(item.priceCents as number, locale)}</p>
            {inCart && cart.lineKey ? (
              <div className="ink-stepper" role="group" aria-label={t.quantityOf(name)}>
                <button
                  type="button"
                  className="ink-stepper__btn"
                  aria-label={t.removeOne(name)}
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
                  aria-label={t.addOne(name)}
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
                aria-label={item.options?.length ? t.chooseAndAdd(name) : t.add(name)}
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
          <p className="ink-row__pending">{NOT_ORDERABLE_TEXT[locale][orderability.reason]}</p>
        )}
      </div>
    </li>
  );
});
