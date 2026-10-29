import type { RestaurantProfile } from "../commerce/restaurant";

const SCHEMA_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * schema.org Restaurant JSON-LD for the future official site, built ONLY from verified
 * facts: pending data (phone, hours, coordinates) is left out instead of published, and
 * no ratings or reviews are ever emitted. Not rendered on the noindex proposals; the
 * chosen storefront adds it to its layout at launch together with its own domain.
 */
export function restaurantJsonLd(profile: RestaurantProfile, siteUrl: string, menuUrl?: string) {
  const a = profile.address;
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: profile.brand.ownerName,
    url: siteUrl,
    servesCuisine: profile.cuisine,
    currenciesAccepted: profile.ordering.currency,
  };
  if (a.status === "verified") {
    data.address = {
      "@type": "PostalAddress",
      streetAddress: a.value.street,
      postalCode: a.value.postalCode,
      addressLocality: a.value.city,
      addressRegion: a.value.province,
      addressCountry: a.value.country,
    };
  }
  if (profile.geo.status === "verified") {
    data.geo = { "@type": "GeoCoordinates", latitude: profile.geo.value.lat, longitude: profile.geo.value.lng };
  }
  if (profile.phone.status === "verified" && profile.phone.value) {
    data.telephone = profile.phone.value.e164;
  }
  if (profile.hours.status === "verified") {
    data.openingHoursSpecification = profile.hours.value.flatMap((d) =>
      d.ranges.map((r) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: `https://schema.org/${SCHEMA_DAYS[d.day]}`,
        opens: r.from,
        closes: r.to,
      })),
    );
  }
  if (menuUrl) data.hasMenu = menuUrl;
  return data;
}
