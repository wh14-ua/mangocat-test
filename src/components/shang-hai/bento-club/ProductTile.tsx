"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Minus, Plus } from "@phosphor-icons/react/dist/ssr";
import type { MenuItem } from "@/lib/commerce/types";
import { getOrderability } from "@/lib/commerce/catalog";
import { NOT_ORDERABLE_TEXT } from "@/lib/commerce/messages";
import { formatMoney } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locale";
import { itemDescription, itemName } from "@/lib/shang-hai/menu-i18n";
import { DishPhoto, useDishPhotos } from "@/components/shang-hai/shared/DishPhotos";
import { useBento } from "./hooks";

export function Stepper({
  name,
  quantity,
  max,
  onInc,
  onDec,
  withTestIds = false,
  incRef,
}: {
  name: string;
  quantity: number;
  max: number;
  onInc: () => void;
  onDec: () => void;
  withTestIds?: boolean;
  incRef?: React.Ref<HTMLButtonElement>;
}) {
  const { t } = useBento();
  return (
    <div className="bc-stepper" role="group" aria-label={t.tile.quantityOf(name)}>
      <button
        type="button"
        onClick={onDec}
        data-testid={withTestIds ? "qty-dec" : undefined}
        aria-label={quantity <= 1 ? t.tile.removeAll(name) : t.tile.removeOne(name)}
      >
        <Minus size={20} weight="bold" aria-hidden />
      </button>
      <span
        className="bc-stepper__qty"
        data-testid={withTestIds ? "line-qty" : undefined}
        aria-live="polite"
        aria-atomic="true"
      >
        {quantity}
      </span>
      <button
        type="button"
        ref={incRef}
        onClick={onInc}
        disabled={quantity >= max}
        data-testid={withTestIds ? "qty-inc" : undefined}
        aria-label={t.tile.addOne(name)}
      >
        <Plus size={20} weight="bold" aria-hidden />
      </button>
    </div>
  );
}

const BUMP: Keyframe[] = [
  { transform: "scale(1)" },
  { transform: "scale(1.035)", offset: 0.4 },
  { transform: "scale(0.99)", offset: 0.7 },
  { transform: "scale(1)" },
];

/**
 * The small grey line under the name: the description when the menu has one. In Spanish,
 * dishes without one keep showing the English name the restaurant published.
 */
function tileNote(item: MenuItem, locale: Locale): { text: string; lang?: "en" } | null {
  const description = itemDescription(item, locale);
  if (description) return { text: description };
  if (locale === "es" && item.nameEn) {
    const en = itemName(item, "en");
    return { text: en.charAt(0).toUpperCase() + en.slice(1), lang: "en" };
  }
  return null;
}

type TileProps = {
  item: MenuItem;
  quantity: number;
  /** Line key when the item has no options (inline stepper). */
  lineKey: string | null;
  max: number;
  onAdd: (item: MenuItem) => boolean;
  onChoose: (item: MenuItem) => void;
  onInc: (key: string) => void;
  onDec: (key: string) => void;
};

/**
 * One compartment of the box. Empty compartments show a round "+"; once the dish is
 * in the order the compartment is "filled" (butter) and the + becomes a stepper.
 * With dish photos on (?fotos=1) a dish that has one gets a small window on top.
 */
export const ProductTile = memo(function ProductTile({
  item,
  quantity,
  lineKey,
  max,
  onAdd,
  onChoose,
  onInc,
  onDec,
}: TileProps) {
  const { locale, t } = useBento();
  const { photoFor } = useDishPhotos();
  const photo = photoFor(item.id);
  const orderability = getOrderability(item);
  const needsOptions = Boolean(item.options?.length);
  const inCart = quantity > 0;
  const showStepper = inCart && !needsOptions && lineKey !== null;
  const [bumps, setBumps] = useState(0);
  const tileRef = useRef<HTMLLIElement>(null);
  const incRef = useRef<HTMLButtonElement>(null);
  const focusStepper = useRef(false);

  // Keyboard users keep their place: after the first add, focus moves to the stepper.
  useEffect(() => {
    if (showStepper && focusStepper.current) {
      focusStepper.current = false;
      incRef.current?.focus();
    }
  }, [showStepper]);

  function bump() {
    setBumps((b) => b + 1);
    const el = tileRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.animate(BUMP, { duration: 340, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" });
  }

  function handleAdd(e: React.MouseEvent<HTMLButtonElement>) {
    if (needsOptions) {
      onChoose(item);
      return;
    }
    // detail === 0 means keyboard activation.
    focusStepper.current = e.detail === 0 || document.activeElement === e.currentTarget;
    if (onAdd(item)) bump();
  }

  function handleInc() {
    if (lineKey) {
      onInc(lineKey);
      bump();
    }
  }

  const name = itemName(item, locale);
  const note = tileNote(item, locale);
  const spicy = item.dietaryTags?.includes("spicy");

  return (
    <li
      ref={tileRef}
      className="bc-tile"
      data-in-cart={inCart || undefined}
      data-blocked={!orderability.orderable || undefined}
    >
      {bumps > 0 && (
        <span key={bumps} className="bc-plus" aria-hidden>
          +1
        </span>
      )}
      {photo && (
        <DishPhoto
          photo={photo}
          decorative
          sizes="(min-width: 1600px) 300px, (min-width: 1024px) 24vw, (min-width: 640px) 30vw, (min-width: 360px) 45vw, 90vw"
          className="bc-tile__photo"
          labelClassName="bc-tile__sticker"
        />
      )}
      <h4 className="bc-tile__name">{name}</h4>
      {(item.pieces || spicy || item.ageRestricted || (needsOptions && inCart)) && (
        <p className="bc-tile__meta">
          {item.pieces && <span className="bc-pill">{t.tile.pieces(item.pieces.count, item.pieces.unit)}</span>}
          {spicy && <span className="bc-pill bc-pill--spicy">{t.tile.spicy}</span>}
          {item.ageRestricted && <span className="bc-pill bc-pill--age">+18</span>}
          {needsOptions && inCart && <span className="bc-pill">{t.tile.inOrder(quantity)}</span>}
        </p>
      )}
      {note && (
        <p className="bc-tile__desc" lang={note.lang}>
          {note.text}
        </p>
      )}
      <div className="bc-tile__foot">
        {orderability.orderable ? (
          <span className="bc-price">{formatMoney(item.priceCents as number, locale)}</span>
        ) : (
          <span className="bc-pending">{NOT_ORDERABLE_TEXT[locale][orderability.reason]}</span>
        )}
        {orderability.orderable &&
          (showStepper ? (
            <Stepper
              name={name}
              quantity={quantity}
              max={max}
              incRef={incRef}
              onInc={handleInc}
              onDec={() => lineKey && onDec(lineKey)}
            />
          ) : (
            <button
              type="button"
              className="bc-add"
              data-testid={`add-${item.id}`}
              aria-label={needsOptions ? t.tile.chooseAndAdd(name) : t.tile.add(name)}
              aria-haspopup={needsOptions ? "dialog" : undefined}
              onClick={handleAdd}
            >
              <Plus size={22} weight="bold" aria-hidden />
            </button>
          ))}
      </div>
    </li>
  );
});
