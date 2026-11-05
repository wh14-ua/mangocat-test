"use client";

import { shangHaiRestaurant } from "@/data/shang-hai/restaurant";
import { formatWeek } from "@/lib/commerce/hours";
import { useLocale } from "@/hooks/shang-hai/useLocale";
import { COMMON_TEXT } from "@/lib/shang-hai/i18n/common";
import { INK_TEXT } from "@/lib/shang-hai/i18n/ink-house";
import { ShPhoto } from "@/components/shang-hai/shared/ShPhoto";
import { inkPhotos } from "./ink-photos";

const r = shangHaiRestaurant;
const address = r.address.value;
const phone = r.phone.value;
/** Closed days, in formatWeek's Monday-first order. */
const CLOSED = [1, 2, 3, 4, 5, 6, 0].map((d) => !r.hours.value.find((h) => h.day === d)?.ranges.length);

/**
 * Practical information, set like the last pages of a book: where, when, how. Every
 * unconfirmed fact says so in place, instead of being presented as definitive.
 */
export function InkInfo() {
  const { locale } = useLocale();
  const t = INK_TEXT[locale];
  const common = COMMON_TEXT[locale];
  const week = formatWeek(r.hours.value, locale);
  return (
    <section id="informacion" className="ink-info" aria-labelledby="ink-info-title">
      <h2 id="ink-info-title" className="ink-info__title" tabIndex={-1} data-anchor-focus>
        {t.info.title}
      </h2>

      <div className="ink-info__grid">
        <div id="contacto" className="ink-info__block ink-info__where">
          <h3 className="ink-info__h" tabIndex={-1} data-anchor-focus>
            {t.info.where}
          </h3>
          <address className="ink-info__address">
            {address.street}
            <br />
            {address.postalCode} {address.city} ({address.province})
          </address>
          <a href={r.directionsUrl} target="_blank" rel="noopener noreferrer" className="ink-link">
            {common.restaurant.directions}
            <span className="ink-sr-only"> {common.restaurant.directionsHint}</span>
          </a>

          <h3 className="ink-info__h ink-info__h--spaced">{common.restaurant.phone}</h3>
          {phone ? (
            <p>
              <a href={`tel:${phone.e164}`} className="ink-link ink-info__phone">
                {phone.display}
              </a>
            </p>
          ) : null}
          <p className="ink-info__pending">{t.info.phonePending}</p>
        </div>

        <div className="ink-info__block">
          <h3 className="ink-info__h">{t.info.hours}</h3>
          <table className="ink-hours">
            <caption className="ink-sr-only">{t.info.hoursCaption}</caption>
            <tbody>
              {week.map((row, i) => (
                <tr key={row.day} data-closed={CLOSED[i] ? "" : undefined}>
                  <th scope="row">{row.day}</th>
                  <td>{row.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="ink-info__pending">{t.info.hoursPending}</p>
        </div>

        <figure className="ink-info__figure">
          {inkPhotos.tea ? (
            <ShPhoto
              photo={inkPhotos.tea}
              alt={t.photoAlt.tea}
              sizes="(min-width: 900px) 26vw, 80vw"
              className="ink-photo ink-info__img"
            />
          ) : (
            <div className="ink-photo-fallback" aria-hidden="true" />
          )}
          <figcaption className="ink-caption">{common.photos.illustrative}</figcaption>
        </figure>
      </div>

      <div id="como-pedir" className="ink-steps">
        <h3 className="ink-info__h">{t.info.howTitle}</h3>
        <ol className="ink-steps__list">
          <li>
            <span className="ink-steps__num" aria-hidden="true">
              1
            </span>
            <p className="ink-steps__title">{t.info.step1Title}</p>
            <p>{t.info.step1Text}</p>
          </li>
          <li>
            <span className="ink-steps__num" aria-hidden="true">
              2
            </span>
            <p className="ink-steps__title">{t.info.step2Title}</p>
            <p>{t.info.step2Text}</p>
          </li>
          <li>
            <span className="ink-steps__num" aria-hidden="true">
              3
            </span>
            <p className="ink-steps__title">{t.info.step3Title}</p>
            <p>
              {t.info.step3Where(address.street)} {common.pickup.timeAfterAcceptance}
            </p>
          </li>
        </ol>
      </div>

      <aside className="ink-allergens" aria-labelledby="ink-allergens-title">
        <h3 id="ink-allergens-title" className="ink-info__h">
          {t.info.allergens}
        </h3>
        <p>{common.restaurant.allergens}</p>
      </aside>
    </section>
  );
}
