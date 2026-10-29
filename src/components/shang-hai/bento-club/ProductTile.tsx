"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Minus, Plus } from "@phosphor-icons/react/dist/ssr";
import type { MenuItem } from "@/lib/commerce/types";
import { getOrderability, NOT_ORDERABLE_COPY } from "@/lib/commerce/catalog";
import { formatCents } from "@/lib/commerce/money";

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
  return (
    <div className="bc-stepper" role="group" aria-label={`Cantidad de ${name}`}>
      <button
        type="button"
        onClick={onDec}
        data-testid={withTestIds ? "qty-dec" : undefined}
        aria-label={quantity <= 1 ? `Quitar ${name} del pedido` : `Quitar una unidad de ${name}`}
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
        aria-label={`Añadir una unidad de ${name}`}
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

  const description =
    item.description ??
    (item.nameEn ? item.nameEn.charAt(0).toUpperCase() + item.nameEn.slice(1) : undefined);
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
      <h4 className="bc-tile__name">{item.name}</h4>
      {(item.pieces || spicy || item.ageRestricted || (needsOptions && inCart)) && (
        <p className="bc-tile__meta">
          {item.pieces && (
            <span className="bc-pill">
              {item.pieces.count} {item.pieces.unit === "piezas" ? "pzs" : "uds"}
            </span>
          )}
          {spicy && <span className="bc-pill bc-pill--spicy">Picante</span>}
          {item.ageRestricted && <span className="bc-pill bc-pill--age">+18</span>}
          {needsOptions && inCart && <span className="bc-pill">{quantity} en tu pedido</span>}
        </p>
      )}
      {description && (
        <p className="bc-tile__desc" lang={item.description ? undefined : "en"}>
          {description}
        </p>
      )}
      <div className="bc-tile__foot">
        {orderability.orderable ? (
          <span className="bc-price">{formatCents(item.priceCents as number)}</span>
        ) : (
          <span className="bc-pending">{NOT_ORDERABLE_COPY[orderability.reason]}</span>
        )}
        {orderability.orderable &&
          (showStepper ? (
            <Stepper
              name={item.name}
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
              aria-label={needsOptions ? `Elegir opciones y añadir ${item.name}` : `Añadir ${item.name}`}
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
