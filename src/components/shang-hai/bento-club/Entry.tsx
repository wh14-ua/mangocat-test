import { CaretDown, MagnifyingGlass, MapPin } from "@phosphor-icons/react/dist/ssr";
import { ShPhoto } from "@/components/shang-hai/shared/ShPhoto";
import { formatCents } from "@/lib/commerce/money";
import { shangHaiRestaurant } from "@/data/shang-hai/restaurant";
import {
  BENTO_SECTIONS,
  CHEAPEST_MENU,
  COMBOS_FROM,
  HERO_PHOTO,
  MENUS_FROM,
  TOTAL_VISIBLE_ITEMS,
  categoryDomId,
} from "./data";
import { PickupSticker, SectionArt } from "./Graphics";

type Vars = React.CSSProperties & { "--i"?: number };
const order = (i: number): Vars => ({ "--i": i });

const combosPieces = (() => {
  const counts = BENTO_SECTIONS.flatMap((s) => s.categories)
    .find((c) => c.category.id === "combos")
    ?.items.map((i) => i.pieces?.count)
    .filter((n): n is number => Boolean(n));
  return counts?.length ? `De ${Math.min(...counts)} a ${Math.max(...counts)} piezas` : null;
})();

/** The entry tray: the brand, one photo, the order button and two real catalog facts. */
export function EntryTray({ onSearch }: { onSearch: () => void }) {
  const a = shangHaiRestaurant.address.value;
  return (
    <section className="bc-hero" aria-labelledby="bc-title">
      <div className="bc-tray">
        <div className="bc-cell bc-cell--butter bc-brand bc-in" style={order(0)}>
          <h1 id="bc-title" className="bc-brand__name">
            <span>SHANG</span> <span>HAI</span>
          </h1>
          <p className="bc-brand__desc">
            <span>Restaurante Asiático</span>
            <span>Orihuela</span>
          </p>
          <PickupSticker className="bc-sticker" />
        </div>

        <figure className="bc-cell bc-cell--lime bc-photo bc-in" style={order(1)}>
          <div className="bc-window">
            <ShPhoto
              photo={HERO_PHOTO}
              priority
              sizes="(min-width: 1024px) 34vw, (min-width: 640px) 34vw, 50vw"
            />
          </div>
          <figcaption className="bc-caption">Imagen ilustrativa</figcaption>
        </figure>

        <a
          href="#carta"
          className="bc-cell bc-cell--black bc-cta bc-in"
          style={order(2)}
          data-testid="go-to-menu"
        >
          <span className="bc-cta__title">Pide para recoger</span>
          <span className="bc-cta__meta">Carta completa: {TOTAL_VISIBLE_ITEMS} platos</span>
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
            <span className="bc-fact__label">Combos</span>
            <span className="bc-fact__price">
              <span className="bc-fact__from">desde</span>
              {formatCents(COMBOS_FROM)}
            </span>
            {combosPieces && <span className="bc-fact__label">{combosPieces}</span>}
          </a>
        )}

        {MENUS_FROM !== null && (
          <a
            href={`#${categoryDomId("menus")}`}
            className="bc-cell bc-cell--paper bc-fact bc-fact--2 bc-in"
            style={order(4)}
          >
            <span className="bc-fact__label">Menús para compartir</span>
            <span className="bc-fact__price">
              <span className="bc-fact__from">desde</span>
              {formatCents(MENUS_FROM)}
            </span>
            {CHEAPEST_MENU && <span className="bc-fact__note">{CHEAPEST_MENU.name}</span>}
          </a>
        )}

        <button type="button" className="bc-cell bc-searchcell bc-in" style={order(5)} onClick={onSearch}>
          <span className="bc-searchcell__q">
            <strong>¿Qué te apetece?</strong>
            <span>Busca entre {TOTAL_VISIBLE_ITEMS} platos</span>
          </span>
          <span className="bc-searchcell__icon" aria-hidden>
            <MagnifyingGlass size={22} weight="bold" />
          </span>
        </button>

        <div className="bc-cell bc-cell--paper bc-pickupcell bc-in" style={order(5)}>
          <span className="bc-fact__label">Recogida en el local</span>
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
            Cómo llegar
            <span className="bc-sr"> (se abre Google Maps)</span>
          </a>
        </div>
      </div>

      <ul className="bc-entries" aria-label="Secciones de la carta">
        {BENTO_SECTIONS.map((s, i) => (
          <li key={s.id} className="bc-in" style={order(6 + i)}>
            <a className="bc-entry" data-tone={s.tone} href={`#${s.domId}`}>
              <SectionArt section={s.id} className="bc-entry__art" />
              <span className="bc-entry__name">{s.name}</span>
              <span className="bc-entry__count">{s.itemCount} platos</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
