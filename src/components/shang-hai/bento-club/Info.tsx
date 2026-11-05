"use client";

import Link from "next/link";
import { MapPin, Phone } from "@phosphor-icons/react/dist/ssr";
import { shangHaiRestaurant } from "@/data/shang-hai/restaurant";
import { formatWeek } from "@/lib/commerce/hours";
import { CHECKOUT_KIND } from "@/lib/shang-hai/checkout";
import { SHANG_HAI_CREDITS_PATH } from "@/lib/shang-hai/storefronts";
import { useBento } from "./hooks";

const r = shangHaiRestaurant;

/** Practical information as a tray of labelled compartments. Pending facts say so. */
export function InfoSection() {
  const { locale, t, c } = useBento();
  const a = r.address.value;
  const phone = r.phone.value;
  const week = formatWeek(r.hours.value, locale);
  const closed = formatWeek([], locale)[0].text;
  return (
    <section id="info" className="bc-info" aria-labelledby="bc-info-title">
      <h2 id="bc-info-title" className="bc-info__title">
        {t.info.title}
      </h2>
      <div className="bc-info__grid">
        <div className="bc-info__cell bc-cell--butter">
          <h3 className="bc-info__h">{c.pickup.title}</h3>
          <p className="bc-info__big">
            {a.street}
            <br />
            {a.postalCode} {a.city} ({a.province})
          </p>
          <a className="bc-linkbtn" href={r.directionsUrl} target="_blank" rel="noopener noreferrer">
            <MapPin size={18} weight="bold" aria-hidden />
            {c.restaurant.directions}
            <span className="bc-sr"> {c.restaurant.directionsHint}</span>
          </a>
        </div>

        <div className="bc-info__cell bc-cell--black">
          <h3 className="bc-info__h">{t.info.howItWorks}</h3>
          <ol className="bc-steps">
            {t.info.steps.map((step, i) => (
              <li key={i}>
                <div>
                  <strong>{step.title}</strong>
                  <span>{"text" in step ? step.text : c.pickup.timeAfterAcceptance}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="bc-info__cell bc-cell--lime">
          <h3 className="bc-info__h">{c.restaurant.hours}</h3>
          <span className="bc-flag">{t.info.hoursFlag}</span>
          <dl className="bc-hours">
            {week.map((row) => (
              <div key={row.day} style={{ display: "contents" }}>
                <dt>{row.day}</dt>
                <dd data-closed={row.text === closed || undefined}>{row.text}</dd>
              </div>
            ))}
          </dl>
          <p className="bc-info__note">{t.info.hoursNote}</p>
        </div>

        <div className="bc-info__cell bc-cell--paper">
          <h3 className="bc-info__h">{c.restaurant.phone}</h3>
          {phone && (
            <a className="bc-linkbtn" href={`tel:${phone.e164}`}>
              <Phone size={18} weight="bold" aria-hidden />
              {phone.display}
            </a>
          )}
          <span className="bc-flag">{t.info.phoneFlag}</span>
          <p className="bc-info__note">{t.info.phoneNote}</p>
        </div>

        <div className="bc-info__cell bc-cell--paper">
          <h3 className="bc-info__h">{t.info.allergens}</h3>
          <p className="bc-info__note">{c.restaurant.allergens}</p>
        </div>

        <div className="bc-info__cell bc-cell--tomato">
          <h3 className="bc-info__h">{t.info.delivery}</h3>
          <p className="bc-info__note">{t.info.deliveryNote}</p>
        </div>
      </div>
    </section>
  );
}

export function BentoFooter() {
  const { t, c } = useBento();
  const a = r.address.value;
  return (
    <footer className="bc-footer">
      <p className="bc-footer__brand">SHANG HAI</p>
      <div className="bc-footer__row">
        <span>{c.brand.descriptor}</span>
        <span>
          {a.street}, {a.postalCode} {a.city}
        </span>
      </div>
      <div className="bc-footer__row">
        <span>{t.footer.photos}</span>
        <Link href={SHANG_HAI_CREDITS_PATH}>{t.footer.credits}</Link>
        {CHECKOUT_KIND === "demo" && <span>{t.footer.demo}</span>}
      </div>
      <p className="bc-fine">{t.footer.byline}</p>
    </footer>
  );
}
