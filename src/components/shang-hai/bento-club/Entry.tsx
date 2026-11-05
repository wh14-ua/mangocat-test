"use client";

import { CaretDown, MagnifyingGlass, MapPin } from "@phosphor-icons/react/dist/ssr";
import { ShPhoto } from "@/components/shang-hai/shared/ShPhoto";
import { formatMoney } from "@/lib/i18n/format";
import { itemName, sectionName } from "@/lib/shang-hai/menu-i18n";
import { shangHaiRestaurant } from "@/data/shang-hai/restaurant";
import {
  BENTO_SECTIONS,
  CHEAPEST_MENU,
  COMBO_PIECES,
  COMBOS_FROM,
  HERO_PHOTO,
  HERO_PHOTO_KEY,
  MENUS_FROM,
  TOTAL_VISIBLE_ITEMS,
  categoryDomId,
} from "./data";
import { PickupSticker, SectionArt } from "./Graphics";
import { useBento } from "./hooks";

type Vars = React.CSSProperties & { "--i"?: number };
const order = (i: number): Vars => ({ "--i": i });

/** The entry tray: the brand, one photo, the order button and two real catalog facts. */
export function EntryTray({ onSearch }: { onSearch: () => void }) {
  const { locale, t, c } = useBento();
  const a = shangHaiRestaurant.address.value;
  // "Restaurante Asiático · Orihuela": printed as two parts separated by a dot.
  const [kind, town] = c.brand.descriptor.split(" · ");
  return (
    <section className="bc-hero" aria-labelledby="bc-title">
      <div className="bc-tray">
        <div className="bc-cell bc-cell--butter bc-brand bc-in" style={order(0)}>
          <h1 id="bc-title" className="bc-brand__name">
            <span>SHANG</span> <span>HAI</span>
          </h1>
          <p className="bc-brand__desc">
            <span>{kind}</span>
            {town && <span>{town}</span>}
          </p>
          <PickupSticker className="bc-sticker" label={t.entry.sticker} />
        </div>

        <figure className="bc-cell bc-cell--lime bc-photo bc-in" style={order(1)}>
          <div className="bc-window">
            <ShPhoto
              photo={HERO_PHOTO}
              alt={t.photoAlt[HERO_PHOTO_KEY]}
              priority
              sizes="(min-width: 1024px) 34vw, (min-width: 640px) 34vw, 50vw"
            />
          </div>
          <figcaption className="bc-caption">{c.photos.illustrative}</figcaption>
        </figure>

        <a
          href="#carta"
          className="bc-cell bc-cell--black bc-cta bc-in"
          style={order(2)}
          data-testid="go-to-menu"
        >
          <span className="bc-cta__title">{t.entry.cta}</span>
          <span className="bc-cta__meta">{t.entry.fullMenu(TOTAL_VISIBLE_ITEMS)}</span>
          <span className="bc-cta__go" aria-hidden>
            <CaretDown size={24} weight="bold" />
          </span>
        </a>

        {COMBOS_FROM !== null && (
          <a
            href={`#${categoryDomId("combos")}`}
            className="bc-cell bc-cell--tomato bc-fact bc-fact--1 bc-in"
            style={order(3)}
          >
            <span className="bc-fact__label">{t.entry.combos}</span>
            <span className="bc-fact__price">
              <span className="bc-fact__from">{t.entry.from}</span>
              {formatMoney(COMBOS_FROM, locale)}
            </span>
            {COMBO_PIECES && <span className="bc-fact__label">{t.entry.comboPieces(COMBO_PIECES)}</span>}
          </a>
        )}

        {MENUS_FROM !== null && (
          <a
            href={`#${categoryDomId("menus")}`}
            className="bc-cell bc-cell--paper bc-fact bc-fact--2 bc-in"
            style={order(4)}
          >
            <span className="bc-fact__label">{t.entry.menusToShare}</span>
            <span className="bc-fact__price">
              <span className="bc-fact__from">{t.entry.from}</span>
              {formatMoney(MENUS_FROM, locale)}
            </span>
            {CHEAPEST_MENU && <span className="bc-fact__note">{itemName(CHEAPEST_MENU, locale)}</span>}
          </a>
        )}

        <button type="button" className="bc-cell bc-searchcell bc-in" style={order(5)} onClick={onSearch}>
          <span className="bc-searchcell__q">
            <strong>{t.entry.craving}</strong>
            <span>{t.entry.searchAmong(TOTAL_VISIBLE_ITEMS)}</span>
          </span>
          <span className="bc-searchcell__icon" aria-hidden>
            <MagnifyingGlass size={22} weight="bold" />
          </span>
        </button>

        <div className="bc-cell bc-cell--paper bc-pickupcell bc-in" style={order(5)}>
          <span className="bc-fact__label">{c.pickup.title}</span>
          <span style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>
            {a.street}
            <br />
            {a.postalCode} {a.city}
          </span>
          <a
            className="bc-linkbtn"
            href={shangHaiRestaurant.directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MapPin size={18} weight="bold" aria-hidden />
            {c.restaurant.directions}
            <span className="bc-sr"> {c.restaurant.directionsHint}</span>
          </a>
        </div>
      </div>

      <ul className="bc-entries" aria-label={t.entry.sections}>
        {BENTO_SECTIONS.map((s, i) => (
          <li key={s.id} className="bc-in" style={order(6 + i)}>
            <a className="bc-entry" data-tone={s.tone} href={`#${s.domId}`}>
              <SectionArt section={s.id} className="bc-entry__art" />
              <span className="bc-entry__name">{sectionName(s.id, locale)}</span>
              <span className="bc-entry__count">{t.count.dishes(s.itemCount)}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
