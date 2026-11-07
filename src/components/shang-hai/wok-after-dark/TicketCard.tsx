"use client";

import { memo } from "react";
import type { MenuItem } from "@/lib/commerce/types";
import { getOrderability } from "@/lib/commerce/catalog";
import { splitCents } from "@/lib/commerce/money";
import { formatMoney } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locale";
import { itemAltName, itemDescription, itemName } from "@/lib/shang-hai/menu-i18n";
import { useLocale } from "@/hooks/shang-hai/useLocale";
import { DishPhoto, useDishPhotos } from "@/components/shang-hai/shared/DishPhotos";
import { AddControl } from "./AddControl";
import { useWokText } from "./WokLanguage";

/**
 * Loud split price: big euros, small cents and symbol. Spanish "19,45€"; English keeps
 * the same split in its own order and separator, "€19.45".
 */
export function Price({ cents, locale, className = "" }: { cents: number; locale: Locale; className?: string }) {
  const { euros, cents: c } = splitCents(cents);
  return (
    <p className={`wok-price ${className}`}>
      <span className="wok-sr">{formatMoney(cents, locale)}</span>
      <span aria-hidden>
        {locale === "en" ? (
          <>
            <small className="wok-price-cur">€</small>
            {Math.trunc(cents / 100).toLocaleString("en-GB")}
            <small>.{c}</small>
          </>
        ) : (
          <>
            {euros}
            <small>,{c}€</small>
          </>
        )}
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
  const { locale } = useLocale();
  const t = useWokText();
  const { photoFor } = useDishPhotos();
  const photo = photoFor(item.id);
  const Heading = headingLevel === 3 ? "h3" : "h4";
  const spicy = item.dietaryTags?.includes("spicy");
  const orderable = getOrderability(item).orderable;
  // The Spanish ticket keeps the English name the restaurant publishes for some dishes (in
  // its reviewed wording); the English ticket needs no second name.
  const altName = locale === "es" && item.nameEn ? itemAltName(item, "es") : null;
  const description = itemDescription(item, locale);

  return (
    <article className="wok-ticket" data-incart={qty > 0} aria-labelledby={`dish-${item.id}`}>
      {photo && (
        <DishPhoto
          photo={photo}
          decorative
          sizes="(min-width: 1280px) 24rem, (min-width: 640px) 46vw, 92vw"
          className="wok-dish-photo"
          imgClassName="wok-slant aspect-[16/9] h-auto w-full bg-[var(--wok-petrol-3)] object-cover"
          labelClassName="wok-cond wok-muted mt-2 text-right text-[0.6875rem]"
        />
      )}
      <div className="flex min-h-[1.375rem] items-start justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {item.pieces && <span className="wok-badge">{t.card.pieces(item.pieces.count, item.pieces.unit)}</span>}
          {spicy && <span className="wok-badge wok-badge--heat">{t.card.spicy}</span>}
          {item.ageRestricted && <span className="wok-badge">{t.card.adults}</span>}
        </div>
        {qty > 0 && (
          <span className="wok-qty-mark wok-nums" aria-hidden>
            ×{qty}
          </span>
        )}
      </div>
      <Heading id={`dish-${item.id}`} className="wok-ticket-name">
        {itemName(item, locale)}
      </Heading>
      {altName && (
        <p lang="en" className="wok-muted -mt-1 text-[0.875rem] italic leading-snug">
          {altName}
        </p>
      )}
      {description && <p className="wok-muted text-[0.9375rem] leading-snug">{description}</p>}
      <div className="mt-auto flex items-end justify-between gap-3 pt-3">
        {orderable && item.priceCents !== null ? <Price cents={item.priceCents} locale={locale} /> : <span />}
        <AddControl item={item} qty={qty} lineKey={lineKey} />
      </div>
    </article>
  );
});
