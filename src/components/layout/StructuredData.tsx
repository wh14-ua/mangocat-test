import { site } from "@/config";

/**
 * Restaurant structured data (schema.org) for rich results. Values come from the
 * site config; the opening-hours specification mirrors the displayed hours.
 */
export function StructuredData() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": site.seo.url,
    name: site.name,
    url: site.seo.url,
    image: [`${site.seo.url}${site.seo.ogImage}`],
    description: site.seo.description,
    servesCuisine: site.cuisine,
    priceRange: site.priceRange,
    telephone: site.contact.phoneDisplay,
    email: site.contact.email,
    acceptsReservations: true,
    address: {
      "@type": "PostalAddress",
      streetAddress: site.address.line1,
      addressLocality: site.address.city,
      postalCode: site.address.postalCode,
      addressCountry: "FR",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 45.7638,
      longitude: 4.8286,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Wednesday", "Thursday"],
        opens: "18:30",
        closes: "22:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Friday", "Saturday"],
        opens: "12:00",
        closes: "13:30",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Friday", "Saturday"],
        opens: "18:30",
        closes: "22:00",
      },
    ],
    sameAs: site.social.map((s) => s.href),
  };

  // Static JSON-LD built entirely from our own trusted config. We additionally
  // escape "<" so a value can never close the <script> element (defense in depth).
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
