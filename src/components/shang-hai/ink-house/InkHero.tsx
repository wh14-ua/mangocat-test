"use client";

import { shangHaiRestaurant } from "@/data/shang-hai/restaurant";
import { ShPhoto } from "@/components/shang-hai/shared/ShPhoto";
import { useLocale } from "@/hooks/shang-hai/useLocale";
import { COMMON_TEXT } from "@/lib/shang-hai/i18n/common";
import { INK_TEXT } from "@/lib/shang-hai/i18n/ink-house";
import { Seal } from "./Seal";
import { InkHeroActions } from "./InkHeroActions";
import { inkPhotos } from "./ink-photos";

const address = shangHaiRestaurant.address.value;

/**
 * The one orchestrated moment of INK HOUSE: on load the two title lines are wiped in
 * like a brush stroke, the photograph blooms out of an ink blot, and the seal is pressed
 * last. Pure CSS (the language only swaps text nodes); everything is static under
 * reduced motion.
 */
export function InkHero() {
  const { locale } = useLocale();
  const t = INK_TEXT[locale];
  const common = COMMON_TEXT[locale];
  const photo = inkPhotos.hero;
  return (
    <section className="ink-hero" aria-labelledby="ink-hero-title">
      <div className="ink-hero__rail">
        <Seal className="ink-hero__seal" label={t.hero.sealLabel} />
        <p className="ink-hero__address">
          {address.street} <span aria-hidden="true">·</span> {address.city}
        </p>
      </div>

      <h1 id="ink-hero-title" className="ink-hero__title">
        <span className="ink-hero__line" style={{ ["--d" as string]: "80ms" }}>
          SHANG
        </span>
        <span className="ink-hero__line ink-hero__line--offset" style={{ ["--d" as string]: "260ms" }}>
          HAI
        </span>
        <span className="ink-sr-only"> — {common.brand.descriptor}</span>
      </h1>

      <div className="ink-hero__lede">
        <p className="ink-hero__descriptor" aria-hidden="true">
          {common.brand.descriptor}
        </p>
        <p className="ink-hero__intro">{t.hero.intro}</p>
        <InkHeroActions />
      </div>

      <figure className="ink-hero__figure">
        <div className="ink-hero__frame">
          {photo ? (
            <ShPhoto
              photo={photo}
              alt={t.photoAlt.hero}
              priority
              sizes="(min-width: 900px) 34vw, 72vw"
              className="ink-hero__img ink-photo"
            />
          ) : (
            <div className="ink-photo-fallback" aria-hidden="true" />
          )}
        </div>
        <figcaption className="ink-caption">{common.photos.illustrative}</figcaption>
      </figure>
    </section>
  );
}
