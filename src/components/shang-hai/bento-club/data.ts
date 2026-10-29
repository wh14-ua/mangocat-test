import type { MenuCategory, MenuItem } from "@/lib/commerce/types";
import { getOrderability } from "@/lib/commerce/catalog";
import {
  MENU_SECTIONS,
  categoryDisplayName,
  sectionOfCategory,
  shangHaiCatalog,
  type MenuSectionId,
} from "@/lib/shang-hai/catalog";
import { shangHaiPhotos } from "@/data/shang-hai/photos";
import type { PhotoLike } from "@/components/shang-hai/shared/ShPhoto";

/**
 * BENTO CLUB — derived, presentation-only data. Every number shown on the page is
 * computed from the shared catalog (never typed by hand).
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

const shareLine = (() => {
  const combos = shangHaiCatalog.sections.find((s) => s.category.id === "combos")?.items ?? [];
  const menus = shangHaiCatalog.sections.find((s) => s.category.id === "menus")?.items ?? [];
  const pieces = combos.map((i) => i.pieces?.count).filter((n): n is number => Boolean(n));
  const people = menus
    .map((i) => Number(i.name.match(/para (\d+) personas/i)?.[1]))
    .filter((n) => Number.isFinite(n) && n > 0);
  const combosPart = pieces.length
    ? `Combos de ${Math.min(...pieces)} a ${Math.max(...pieces)} piezas`
    : "Combos";
  const menusPart = people.length
    ? `menús para ${Math.min(...people)} a ${Math.max(...people)} personas`
    : "menús para compartir";
  return `${combosPart} y ${menusPart}.`;
})();

export const SECTION_LINE: Record<SectionKey, string> = {
  "para-compartir": shareLine,
  "cocina-china": "Entrantes, sopas, dim sum, pato, pollo, ternera, marisco, arroces y tallarines.",
  sushi: "Nigiris, makis, uramakis, temakis, gunkan y bowls.",
  bebidas: "Cerveza, refrescos, agua, zumos, cava y vinos.",
  otros: "",
};

export type BentoCategory = {
  category: MenuCategory;
  label: string;
  items: MenuItem[];
  section: SectionKey;
  domId: string;
};

export type BentoSection = {
  id: SectionKey;
  name: string;
  line: string;
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
      label: categoryDisplayName(s.category.id, s.category.name),
      items: s.items,
      section: section.id,
      domId: categoryDomId(s.category.id),
    }));
  return {
    id: section.id,
    name: section.name,
    line: SECTION_LINE[section.id],
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

export const HERO_PHOTO: PhotoLike = P.sushi;

/** Photo compartments that open a category ("Imagen ilustrativa"). */
export const CATEGORY_PHOTO: Partial<Record<string, PhotoLike>> = {
  entrantes: P.springrolls,
  "dim-sum": P.dumplings,
  acompanamientos: P.rice,
  bowls: P.poke,
};

export const POPULAR_CATEGORY_IDS = ["combos", "makis", "dim-sum", "pollo", "menus"];
