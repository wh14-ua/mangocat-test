"use client";

import { memo } from "react";
import type { MenuItem } from "@/lib/commerce/types";
import { getOrderability } from "@/lib/commerce/catalog";
import { formatCents, splitCents } from "@/lib/commerce/money";
import { AddControl } from "./AddControl";

export function Price({ cents, className = "" }: { cents: number; className?: string }) {
  const { euros, cents: c } = splitCents(cents);
  return (
    <p className={`wok-price ${className}`}>
      <span className="wok-sr">{formatCents(cents)}</span>
      <span aria-hidden>
        {euros}
        <small>,{c}€</small>
      </span>
    </p>
  );
}

/** A dish as a kitchen ticket: perforated top, condensed name, loud price, big add key. */
export const TicketCard = memo(function TicketCard({
  item,
  qty,
  lineKey,
  headingLevel = 4,
}: {
  item: MenuItem;
  qty: number;
  lineKey: string | null;
  headingLevel?: 3 | 4;
}) {
  const Heading = headingLevel === 3 ? "h3" : "h4";
  const spicy = item.dietaryTags?.includes("spicy");
  const orderable = getOrderability(item).orderable;

  return (
    <article className="wok-ticket" data-incart={qty > 0} aria-labelledby={`dish-${item.id}`}>
      <div className="flex min-h-[1.375rem] items-start justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {item.pieces && (
            <span className="wok-badge">
              {item.pieces.count} {item.pieces.unit === "piezas" ? "pzs" : "uds"}
            </span>
          )}
          {spicy && <span className="wok-badge wok-badge--heat">Pica</span>}
          {item.ageRestricted && <span className="wok-badge">+18</span>}
        </div>
        {qty > 0 && (
          <span className="wok-qty-mark wok-nums" aria-hidden>
            ×{qty}
          </span>
        )}
      </div>
      <Heading id={`dish-${item.id}`} className="wok-ticket-name">
        {item.name}
      </Heading>
      {item.nameEn && (
        <p lang="en" className="wok-muted -mt-1 text-[0.875rem] italic leading-snug">
          {item.nameEn}
        </p>
      )}
      {item.description && (
        <p className="wok-muted text-[0.9375rem] leading-snug">{item.description}</p>
      )}
      <div className="mt-auto flex items-end justify-between gap-3 pt-3">
        {orderable && item.priceCents !== null ? <Price cents={item.priceCents} /> : <span />}
        <AddControl item={item} qty={qty} lineKey={lineKey} />
      </div>
    </article>
  );
});
