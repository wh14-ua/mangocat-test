import { shangHaiRestaurant } from "@/data/shang-hai/restaurant";
import { ShPhoto } from "@/components/shang-hai/shared/ShPhoto";
import { Seal } from "./Seal";
import { InkHeroActions } from "./InkHeroActions";
import { inkPhotos } from "./ink-photos";

const address = shangHaiRestaurant.address.value;

/**
 * The one orchestrated moment of INK HOUSE: on load the two title lines are wiped in
 * like a brush stroke, the photograph blooms out of an ink blot, and the seal is pressed
 * last. Pure CSS (no hydration needed); everything is static under reduced motion.
 */
export function InkHero() {
  const photo = inkPhotos.hero;
  return (
    <section className="ink-hero" aria-labelledby="ink-hero-title">
      <div className="ink-hero__rail">
        <Seal className="ink-hero__seal" label="Sello de SHANG HAI con los caracteres 上海" />
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
        <span className="ink-sr-only"> — {shangHaiRestaurant.brand.descriptor}</span>
      </h1>

      <div className="ink-hero__lede">
        <p className="ink-hero__descriptor" aria-hidden="true">
          {shangHaiRestaurant.brand.descriptor}
        </p>
        <p className="ink-hero__intro">Cocina china y sushi. Pedidos para recoger en Orihuela.</p>
        <InkHeroActions />
      </div>

      <figure className="ink-hero__figure">
        <div className="ink-hero__frame">
          {photo ? (
            <ShPhoto
              photo={photo}
              priority
              sizes="(min-width: 900px) 34vw, 72vw"
              className="ink-hero__img ink-photo"
            />
          ) : (
            <div className="ink-photo-fallback" aria-hidden="true" />
          )}
        </div>
        <figcaption className="ink-caption">Imagen ilustrativa</figcaption>
      </figure>
    </section>
  );
}
