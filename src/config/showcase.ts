/**
 * MangoCat Studios - Design Showcase.
 *
 * Five independent art directions for ONE fictional restaurant (MERIDIA), all built
 * from the SAME base content below. This file is the single source of truth for both
 * the catalog page (/showcase) and the five demo landing pages (/showcase/<slug>).
 *
 * It is fully separate from the ATELIER configuration; nothing here is imported by the
 * ATELIER site, and the demos never import ATELIER's components.
 */

// Deployment sub-path (see `basePath` in next.config.ts). Prefixed onto every asset
// path so photography and preview captures resolve under GitHub Pages. "" on a root domain.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const asset = (p: string) => `${BASE_PATH}${p}`;

/* ─────────────────────────── Shared base content ─────────────────────────── */

export interface ShowcaseDish {
  name: string;
  note: string;
}

export interface ShowcaseContent {
  name: string;
  tagline: string;
  intro: string;
  about: string;
  dishes: ShowcaseDish[];
  chef: { name: string; role: string };
  quote: { text: string; author: string };
  hours: { days: string; detail: string }[];
  address: { street: string; city: string };
  contact: { phone: string; phoneHref: string; email: string };
  social: { label: string; handle: string; href: string };
  foundedYear: number;
  ctaLabel: string;
}

/** The same restaurant, rendered five ways. Identical facts across every design. */
export const meridia: ShowcaseContent = {
  name: "MERIDIA",
  tagline: "A seasonal kitchen by the harbour.",
  intro:
    "One menu that follows the morning market and the tide, cooked over fire and served without ceremony.",
  about:
    "MERIDIA is a twenty-eight seat dining room on the Valencia waterfront. There is no fixed carte. Each afternoon the kitchen writes the night's menu around what the boats land and what the garden gives, then cooks most of it over embers.",
  dishes: [
    { name: "Carabinero prawn", note: "fermented tomato, basil oil" },
    { name: "Aged duck", note: "quince, burnt honey" },
    { name: "Turbot on the bone", note: "mussel butter, samphire" },
    { name: "Sheep’s milk tart", note: "thyme, dark honey" },
  ],
  chef: { name: "Marcela Pons", role: "Chef and owner" },
  quote: {
    text: "We cook what the market and the tide decide. Nothing earlier, nothing more.",
    author: "Marcela Pons",
  },
  hours: [
    { days: "Tuesday to Saturday", detail: "Dinner, 19:00 to 23:00" },
    { days: "Friday and Saturday", detail: "Lunch, 13:00 to 15:30" },
    { days: "Sunday and Monday", detail: "Closed" },
  ],
  address: { street: "Paseo Marítimo 18", city: "Valencia" },
  contact: {
    phone: "+34 961 20 18 40",
    phoneHref: "tel:+34961201840",
    email: "hola@meridia.restaurant",
  },
  social: { label: "Instagram", handle: "@meridia", href: "https://instagram.com" },
  foundedYear: 2016,
  ctaLabel: "Book a table",
};

/* ─────────────────────────── Per-design photography ───────────────────────────
 * Each design has its own grade of licensed photography under
 * /public/images/showcase/<slug>/. Keys are shared; a design uses the ones it needs.
 */
type DesignImageSet = { hero: string; dish: string; room: string; detail: string };

const imageSet = (slug: string): DesignImageSet => ({
  hero: asset(`/images/showcase/${slug}/hero.jpg`),
  dish: asset(`/images/showcase/${slug}/dish.jpg`),
  room: asset(`/images/showcase/${slug}/room.jpg`),
  detail: asset(`/images/showcase/${slug}/detail.jpg`),
});

export const showcaseImages: Record<string, DesignImageSet> = {
  "luxury-dark": imageSet("luxury-dark"),
  "editorial-minimalist": imageSet("editorial-minimalist"),
  "traditional-authentic": imageSet("traditional-authentic"),
  "modern-vibrant": imageSet("modern-vibrant"),
  "natural-organic": imageSet("natural-organic"),
};

/* Playful Handcraft is a collage-heavy, highly interactive direction and needs a
 * richer photo set than the shared four-key `imageSet`: a hero, a harbour shot, a
 * fire shot, a room, a single feature dish, and four dishes for the floating row. */
export const playfulHandcraftImages = {
  hero: asset("/images/showcase/playful-handcraft/hero.jpg"),
  harbour: asset("/images/showcase/playful-handcraft/harbour.jpg"),
  fire: asset("/images/showcase/playful-handcraft/fire.jpg"),
  room: asset("/images/showcase/playful-handcraft/room.jpg"),
  feature: asset("/images/showcase/playful-handcraft/feature.jpg"),
  dishes: [
    asset("/images/showcase/playful-handcraft/dish-1.jpg"),
    asset("/images/showcase/playful-handcraft/dish-2.jpg"),
    asset("/images/showcase/playful-handcraft/dish-3.jpg"),
    asset("/images/showcase/playful-handcraft/dish-4.jpg"),
  ],
} as const;

/* ─────────────────────────── Design registry (catalog) ───────────────────────────
 * Metadata the catalog page renders. `previewDesktop` / `previewMobile` point at the
 * Playwright captures saved under /public/images/showcase/previews/.
 */
export interface ShowcaseDesign {
  slug: string;
  name: string;
  tagline: string; // short descriptor (catalog card)
  description: string; // one or two sentences (catalog), Spanish for the agency's clients
  dials: { variance: number; motion: number; density: number };
  type: string; // typographic pairing, shown as a spec
  accent: string; // hex, for the catalog swatch
  background: string; // hex, for the catalog swatch
  foreground: string; // hex, readable on `background`
  previewDesktop: string;
  previewMobile: string;
}

const preview = (slug: string, size: "desktop" | "mobile") =>
  asset(`/images/showcase/previews/${slug}-${size}.jpg`);

export const showcaseDesigns: ShowcaseDesign[] = [
  {
    slug: "luxury-dark",
    name: "Luxury Dark",
    tagline: "Cinematic, exclusive, nocturnal.",
    description:
      "Negro y oro frío, fotografía cinematográfica y tipografía grabada. Una propuesta exclusiva y de alta gama, pensada para la noche.",
    dials: { variance: 7, motion: 6, density: 3 },
    type: "Cinzel / Jost",
    accent: "#C8A24A",
    background: "#0A0A0B",
    foreground: "#EDE9E1",
    previewDesktop: preview("luxury-dark", "desktop"),
    previewMobile: preview("luxury-dark", "mobile"),
  },
  {
    slug: "editorial-minimalist",
    name: "Editorial Minimalist",
    tagline: "White space, big type, quiet.",
    description:
      "Composición de revista en blanco y negro, tipografía sofisticada y máximo aire. Elegancia por reducción, con un único acento bermellón.",
    dials: { variance: 6, motion: 3, density: 2 },
    type: "Spectral / Archivo",
    accent: "#D9442F",
    background: "#FBFBF9",
    foreground: "#17171A",
    previewDesktop: preview("editorial-minimalist", "desktop"),
    previewMobile: preview("editorial-minimalist", "mobile"),
  },
  {
    slug: "traditional-authentic",
    name: "Traditional Authentic",
    tagline: "Warm, family-run, with a story.",
    description:
      "Marfil cálido, ladrillo y oliva, con fotografía de producto y relato de familia. Cercanía y oficio, sin caer en el beige de catálogo.",
    dials: { variance: 5, motion: 4, density: 4 },
    type: "Bitter / Work Sans",
    accent: "#B23A2E",
    background: "#F4EADB",
    foreground: "#2E2A25",
    previewDesktop: preview("traditional-authentic", "desktop"),
    previewMobile: preview("traditional-authentic", "mobile"),
  },
  {
    slug: "modern-vibrant",
    name: "Modern Vibrant",
    tagline: "Loud, contemporary, kinetic.",
    description:
      "Color-block, tipografía gigante y un marquee cinético. Mandarina eléctrica sobre hueso. Energía urbana para un público joven.",
    dials: { variance: 9, motion: 8, density: 3 },
    type: "Bricolage Grotesque / Space Grotesk",
    accent: "#FF5A2C",
    background: "#F7F6F2",
    foreground: "#141414",
    previewDesktop: preview("modern-vibrant", "desktop"),
    previewMobile: preview("modern-vibrant", "mobile"),
  },
  {
    slug: "natural-organic",
    name: "Natural Organic",
    tagline: "Earthy, artisanal, calm.",
    description:
      "Tonos tierra y verde oliva, texturas naturales y producto de temporada. Calma artesanal de proximidad y km 0.",
    dials: { variance: 6, motion: 4, density: 3 },
    type: "Newsreader / Mulish",
    accent: "#6E7A4E",
    background: "#EFEBDE",
    foreground: "#2B2E26",
    previewDesktop: preview("natural-organic", "desktop"),
    previewMobile: preview("natural-organic", "mobile"),
  },
  {
    slug: "playful-handcraft",
    name: "Playful Handcraft",
    tagline: "Hand-drawn, warm, kinetic.",
    description:
      "Collage cálido y hecho a mano: papel rasgado, garabatos dibujados a mano y fotografía que cobra vida con el cursor. Energía festiva y muy interactiva, en clave costera.",
    dials: { variance: 9, motion: 9, density: 4 },
    type: "Anton / Hanken Grotesk",
    accent: "#E64A2B",
    background: "#FBF2E2",
    foreground: "#15171D",
    previewDesktop: preview("playful-handcraft", "desktop"),
    previewMobile: preview("playful-handcraft", "mobile"),
  },
];

export const getShowcaseDesign = (slug: string) =>
  showcaseDesigns.find((d) => d.slug === slug);
