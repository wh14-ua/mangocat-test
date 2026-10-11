import type { SiteConfig } from "./types";

/**
 * Business identity, contact, hours, reservations and SEO.
 * Edit this file to adapt the template to another restaurant.
 */
export const site: SiteConfig = {
  name: "ATELIER",
  wordmark: "ATELIER",
  tagline: "Contemporary gastronomy in Lyon.",
  shortDescription:
    "A seasonal tasting menu, a cellar built over a decade, and a dining room of twenty-four seats.",
  legalName: "Atelier Restaurant SAS",
  foundedYear: 2014,
  cuisine: "Contemporary French",
  priceRange: "€€€€",
  locale: "en-IE",
  currency: "EUR",

  address: {
    line1: "12 Quai Saint-Antoine",
    line2: "",
    postalCode: "69002",
    city: "Lyon",
    country: "France",
    mapQuery: "ATELIER, 12 Quai Saint-Antoine, 69002 Lyon, France",
    mapEmbedSrc:
      "https://www.openstreetmap.org/export/embed.html?bbox=4.8206%2C45.7588%2C4.8366%2C45.7688&layer=mapnik&marker=45.7638%2C4.8286",
    directionsUrl:
      "https://www.google.com/maps/dir/?api=1&destination=12+Quai+Saint-Antoine+69002+Lyon+France",
  },

  contact: {
    phoneDisplay: "+33 4 72 00 18 40",
    phoneHref: "tel:+33472001840",
    email: "reservations@atelier.restaurant",
  },

  openingHours: [
    { days: "Wednesday - Thursday", service: "Dinner", time: "18:30 - 22:00" },
    { days: "Friday - Saturday", service: "Lunch", time: "12:00 - 13:30" },
    { days: "Friday - Saturday", service: "Dinner", time: "18:30 - 22:00" },
    { days: "Sunday - Tuesday", service: "Closed", time: "Closed" },
  ],

  reservations: {
    policy:
      "Tables are held for 15 minutes past the reserved time. The full tasting menu is served to the whole table. Please tell us about allergies and dietary needs when you book.",
    leadNote: "Reservations open 60 days ahead, released on the first of each month.",
    partyMax: 8,
    phoneDisplay: "+33 4 72 00 18 40",
    phoneHref: "tel:+33472001840",
    email: "reservations@atelier.restaurant",
    services: [
      { id: "dinner", label: "Dinner", times: ["18:30", "19:00", "19:30", "20:00", "20:30", "21:00"] },
      { id: "lunch", label: "Lunch", times: ["12:00", "12:30", "13:00", "13:30"] },
    ],
  },

  social: [
    { label: "ATELIER on Instagram", href: "https://instagram.com", icon: "instagram" },
    { label: "ATELIER on Facebook", href: "https://facebook.com", icon: "facebook" },
  ],

  nav: [
    { label: "Our Story", href: "/story" },
    { label: "Menu", href: "/menu" },
    { label: "Gallery", href: "/gallery" },
    { label: "Contact", href: "/contact" },
  ],

  seo: {
    // Public URL of the deployed site. On GitHub Pages this includes the
    // "/mangocat-test" project sub-path and MUST match `basePath` in next.config.ts.
    // For a real root-domain deployment, set this to e.g. "https://atelier.restaurant".
    url: "https://wh14-ua.github.io/mangocat-test",
    defaultTitle: "ATELIER · Contemporary Gastronomy in Lyon",
    titleTemplate: "%s · ATELIER",
    description:
      "ATELIER is a contemporary gastronomic restaurant in Lyon. A seasonal tasting menu, a decade-deep cellar, and a dining room that seats twenty-four.",
    keywords: [
      "Lyon restaurant",
      "fine dining Lyon",
      "tasting menu",
      "gastronomic restaurant",
      "contemporary French cuisine",
      "ATELIER",
      "chef's table",
      "wine pairing",
    ],
    ogImage: "/images/og-image.jpg",
    locale: "en_GB",
  },
};

/** The single reservation call-to-action, used identically everywhere (one intent, one label). */
export const reserveCta = { label: "Reserve a Table", href: "/reservations" } as const;
