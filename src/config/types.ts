/**
 * Shared types for ATELIER's configuration layer.
 *
 * All business data (brand, contact, hours, menu, story, imagery) lives in
 * src/config/* and is typed here. Presentation components consume these types
 * and never hard-code business data, so adapting the template to another
 * restaurant means editing src/config/* and swapping /public/images only.
 * See README.md and CUSTOMIZE.md.
 */

export interface NavLink {
  label: string;
  href: string;
}

export interface SocialLink {
  /** Human label, used for aria-label */
  label: string;
  href: string;
  /** Phosphor icon name key handled in the Footer/Nav icon map */
  icon: "instagram" | "facebook" | "x" | "tiktok" | "youtube" | "linkedin";
}

export interface OpeningHour {
  /** e.g. "Wednesday - Friday" */
  days: string;
  /** e.g. "Dinner" */
  service: string;
  /** e.g. "18:00 - 23:00" or "Closed" */
  time: string;
}

export interface Address {
  line1: string;
  line2?: string;
  postalCode: string;
  city: string;
  country: string;
  /** Used to build a maps search / directions link */
  mapQuery: string;
  /** Embeddable map URL (privacy-friendly embed); optional */
  mapEmbedSrc?: string;
  directionsUrl: string;
}

export interface Contact {
  phoneDisplay: string;
  phoneHref: string; // tel:+...
  email: string;
}

export interface Reservations {
  /** Short policy shown on the reservations page */
  policy: string;
  /** How far ahead bookings open */
  leadNote: string;
  /** Max party size the online flow accepts before asking to call */
  partyMax: number;
  /** Fallback contact for real bookings (the demo flow is simulated) */
  phoneDisplay: string;
  phoneHref: string;
  email: string;
  /** Services offered, each with selectable time slots */
  services: { id: string; label: string; times: string[] }[];
}

export interface Seo {
  /** Absolute site URL (used for canonical + OpenGraph) */
  url: string;
  defaultTitle: string;
  /** %s is replaced by the page title */
  titleTemplate: string;
  description: string;
  keywords: string[];
  ogImage: string;
  locale: string; // e.g. "en_GB"
}

export interface SiteConfig {
  name: string;
  /** Wordmark text (usually the name, may differ in casing) */
  wordmark: string;
  tagline: string;
  shortDescription: string;
  legalName: string;
  foundedYear: number;
  cuisine: string;
  priceRange: string; // schema.org priceRange, e.g. "€€€€"
  /** Intl locale + currency used for price/date formatting */
  locale: string; // e.g. "en-IE"
  currency: string; // e.g. "EUR"
  address: Address;
  contact: Contact;
  openingHours: OpeningHour[];
  reservations: Reservations;
  social: SocialLink[];
  nav: NavLink[];
  seo: Seo;
}

export interface ThemeConfig {
  /** Mirrors the CSS custom properties in globals.css for JS consumers */
  colors: Record<string, string>;
  fonts: { display: string; sans: string };
  /** Used for <meta name="theme-color"> */
  themeColor: string;
}

/* ----------------------------------- Menu ---------------------------------- */

export type DietaryCode = "v" | "vg" | "gf" | "n" | "sf" | "df";

export interface DietaryTag {
  code: DietaryCode;
  label: string;
}

export interface MenuItem {
  name: string;
  description: string;
  /** Price in major currency units (e.g. euros). Formatted via Intl. */
  price: number;
  tags?: DietaryCode[];
}

export interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  items: MenuItem[];
}

export interface TastingMenu {
  name: string;
  description: string;
  price: number;
  courses: number;
  pairingName: string;
  pairingPrice: number;
  highlights: string[];
}

export interface MenuConfig {
  intro: string;
  legend: DietaryTag[];
  tasting: TastingMenu;
  categories: MenuCategory[];
}

/* ---------------------------------- Story ---------------------------------- */

export interface Chef {
  name: string;
  role: string;
  portrait: string;
  bio: string[];
  quote: string;
}

export interface ValueItem {
  title: string;
  body: string;
}

export interface StoryConfig {
  eyebrow: string;
  heading: string;
  lead: string;
  opening: { image: string; caption: string };
  philosophy: { heading: string; body: string[]; image: string };
  chef: Chef;
  values: ValueItem[];
  provenance: { heading: string; body: string; images: string[] };
  pullQuote: { text: string; attribution: string };
}

/* ------------------------------- Experiences ------------------------------- */

export interface Experience {
  title: string;
  description: string;
  image: string;
  /** small meta line, e.g. "By reservation" */
  meta: string;
}

/* --------------------------------- Dishes ---------------------------------- */

export interface FeaturedDish {
  name: string;
  note: string;
  image: string;
}

/* --------------------------------- Gallery --------------------------------- */

export type GalleryAspect = "portrait" | "square" | "landscape";

export interface GalleryItem {
  src: string;
  alt: string;
  aspect: GalleryAspect;
  category: string; // matches a GalleryFilter id
}

export interface GalleryFilter {
  id: string;
  label: string;
}

export interface GalleryConfig {
  filters: GalleryFilter[];
  items: GalleryItem[];
}
