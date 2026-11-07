import type { MenuCategory, MenuItem } from "@/lib/commerce/types";
import { getOrderability } from "@/lib/commerce/catalog";
import { MENU_SECTIONS, sectionOfCategory, shangHaiCatalog, type MenuSectionId } from "@/lib/shang-hai/catalog";
import type { BentoText, Span } from "@/lib/shang-hai/i18n/bento-club";
import { shangHaiPhotos } from "@/data/shang-hai/photos";
import type { PhotoLike } from "@/components/shang-hai/shared/ShPhoto";

/**
 * BENTO CLUB — derived, presentation-only data. Every number shown on the page is
 * computed from the shared catalog (never typed by hand). Words come from the
 * dictionaries (bento-club.ts, menu-i18n.ts) in the visitor's language.
 */

export type SectionKey = MenuSectionId | "otros";

/** Each menu section is printed in one colour of the packaging. */
export const SECTION_TONE: Record<SectionKey, "butter" | "tomato" | "lime" | "cream"> = {
  "para-compartir": "butter",
  "cocina-china": "tomato",
  sushi: "lime",
  bebidas: "cream",
  otros: "cream",
};

function span(values: number[]): Span | null {
  return values.length ? { min: Math.min(...values), max: Math.max(...values) } : null;
}

const itemsOf = (categoryId: string) =>
  shangHaiCatalog.sections.find((s) => s.category.id === categoryId)?.items ?? [];

/** Pieces in the combos ("de 14 a 33 piezas"). */
export const COMBO_PIECES = span(
  itemsOf("combos")
    .map((i) => i.pieces?.count)
    .filter((n): n is number => Boolean(n)),
);

/** People per set menu, read from the published names ("Menú para 2 Personas A"). */
export const MENU_PEOPLE = span(
  itemsOf("menus")
    .map((i) => Number(i.name.match(/para (\d+) personas/i)?.[1]))
    .filter((n) => Number.isFinite(n) && n > 0),
);

/** The one-line summary printed on each section band. */
export function sectionLine(section: SectionKey, t: BentoText): string {
  if (section === "para-compartir") return t.menu.shareLine(COMBO_PIECES, MENU_PEOPLE);
  return section === "otros" ? "" : t.menu.sectionLine[section];
}

export type BentoCategory = {
  category: MenuCategory;
  items: MenuItem[];
  section: SectionKey;
  domId: string;
};

export type BentoSection = {
  id: SectionKey;
  tone: (typeof SECTION_TONE)[SectionKey];
  categories: BentoCategory[];
  itemCount: number;
  domId: string;
};

export const categoryDomId = (categoryId: string) => `bc-cat-${categoryId}`;

const byCategory = new Map(shangHaiCatalog.sections.map((s) => [s.category.id, s]));

export const BENTO_SECTIONS: BentoSection[] = MENU_SECTIONS.map((section) => {
  const categories: BentoCategory[] = section.categoryIds
    .map((id) => byCategory.get(id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .map((s) => ({
      category: s.category,
      items: s.items,
      section: section.id,
      domId: categoryDomId(s.category.id),
    }));
  return {
    id: section.id,
    tone: SECTION_TONE[section.id],
    categories,
    itemCount: categories.reduce((n, c) => n + c.items.length, 0),
    domId: `bc-sec-${section.id}`,
  };
});

export const ALL_CATEGORIES: BentoCategory[] = BENTO_SECTIONS.flatMap((s) => s.categories);

export const TOTAL_VISIBLE_ITEMS = shangHaiCatalog.visibleItems.length;

export function sectionToneOf(categoryId: string) {
  return SECTION_TONE[sectionOfCategory(categoryId)];
}

/** Lowest confirmed, orderable price in a category ("desde …"). */
export function fromPrice(categoryId: string): number | null {
  const items = byCategory.get(categoryId)?.items ?? [];
  const prices = items
    .filter((i) => getOrderability(i).orderable && i.priceCents !== null)
    .map((i) => i.priceCents as number);
  return prices.length ? Math.min(...prices) : null;
}

export const COMBOS_FROM = fromPrice("combos");
export const MENUS_FROM = fromPrice("menus");

/** The cheapest set menu, named, so the claim is checkable on the page. */
export const CHEAPEST_MENU = (byCategory.get("menus")?.items ?? [])
  .filter((i) => i.priceCents === MENUS_FROM)
  .at(0);

// ---------------------------------------------------------------------------
// Photography (provisional, illustrative). One use per photo on the whole page.
// ---------------------------------------------------------------------------

const P = shangHaiPhotos.bentoClub;

export type BentoPhotoKey = keyof typeof P;

export const HERO_PHOTO_KEY: BentoPhotoKey = "sushi";
export const HERO_PHOTO: PhotoLike = P[HERO_PHOTO_KEY];

/** Photo compartments that open a category ("Imagen ilustrativa"). */
export const CATEGORY_PHOTO: Partial<Record<string, BentoPhotoKey>> = {
  entrantes: "springrolls",
  "dim-sum": "dumplings",
  acompanamientos: "rice",
  bowls: "poke",
};

export function bentoPhoto(key: BentoPhotoKey): PhotoLike {
  return P[key];
}

export const POPULAR_CATEGORY_IDS = ["combos", "makis", "dim-sum", "pollo", "menus"];
