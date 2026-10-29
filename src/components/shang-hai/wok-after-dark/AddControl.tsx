"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { MenuItem } from "@/lib/commerce/types";
import { getOrderability, NOT_ORDERABLE_COPY } from "@/lib/commerce/catalog";
import { shangHaiOrdering } from "@/lib/shang-hai/catalog";
import { useWokUIActions } from "./WokUI";
import { useWokCartActions } from "./cart-actions";

const SPARKS = [
  { x: -34, y: -30, r: 25 },
  { x: 30, y: -36, r: -18 },
  { x: 40, y: 6, r: 40 },
  { x: -38, y: 12, r: -35 },
  { x: 4, y: -46, r: 12 },
  { x: 18, y: 34, r: -30 },
];

function Sparks({ onDone }: { onDone: () => void }) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {SPARKS.map((s, i) => (
        <motion.span
          key={i}
          className="wok-spark"
          initial={{ x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 }}
          animate={{ x: s.x, y: s.y, scale: 0.2, opacity: 0, rotate: s.r }}
          transition={{ duration: 0.55, ease: [0.15, 0.8, 0.3, 1] }}
          onAnimationComplete={i === 0 ? onDone : undefined}
        />
      ))}
    </span>
  );
}

/**
 * Add key that morphs into a stepper once the dish is on the ticket. Dishes with real
 * options open the chooser; dishes without a confirmed price say so instead.
 */
export function AddControl({
  item,
  qty,
  lineKey,
}: {
  item: MenuItem;
  qty: number;
  lineKey: string | null;
}) {
  const actions = useWokCartActions();
  const ui = useWokUIActions();
  const reduce = useReducedMotion();
  const [bursts, setBursts] = useState<number[]>([]);
  const orderability = getOrderability(item);

  if (!orderability.orderable) {
    return <p className="wok-pending">{NOT_ORDERABLE_COPY[orderability.reason]}</p>;
  }

  const needsOptions = Boolean(item.options?.length);
  const burst = () => {
    if (!reduce) setBursts((b) => [...b, Date.now()]);
  };

  const sparks = (
    <AnimatePresence>
      {bursts.map((id) => (
        <Sparks key={id} onDone={() => setBursts((b) => b.filter((x) => x !== id))} />
      ))}
    </AnimatePresence>
  );

  if (qty > 0 && lineKey && !needsOptions) {
    const atMax = qty >= shangHaiOrdering.limits.maxQuantityPerLine;
    return (
      <div className="wok-stepper relative" role="group" aria-label={`Cantidad de ${item.name}`}>
        <button
          type="button"
          aria-label={`Quitar una unidad de ${item.name}`}
          onClick={() => actions.decrement(lineKey)}
        >
          <span className="wok-minus" aria-hidden />
        </button>
        <output className="wok-nums">{qty}</output>
        <button
          type="button"
          data-testid={`add-${item.id}`}
          aria-label={`Añadir otra unidad de ${item.name}`}
          disabled={atMax}
          className="relative disabled:opacity-40"
          onClick={() => {
            actions.increment(lineKey);
            burst();
          }}
        >
          <span className="wok-plus" aria-hidden />
          {sparks}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="wok-add"
      data-testid={`add-${item.id}`}
      aria-label={needsOptions ? `Añadir ${item.name} (elegir opción)` : `Añadir ${item.name}`}
      aria-haspopup={needsOptions ? "dialog" : undefined}
      onClick={() => {
        if (needsOptions) {
          ui.openChooser(item);
          return;
        }
        if (actions.add(item)) burst();
      }}
    >
      <span className="wok-plus" aria-hidden />
      {sparks}
    </button>
  );
}
