import menu from "../../data/shang-hai/menu.json";
import { shangHaiRestaurant } from "../../data/shang-hai/restaurant";
import { createCatalogIndex } from "../commerce/catalog";
import type { MenuCatalog } from "../commerce/types";

/** The one Shang Hai catalog, shared by the three storefronts and the order Worker. */
export const shangHaiCatalog = createCatalogIndex(menu as MenuCatalog);

export const shangHaiOrdering = shangHaiRestaurant.ordering;

/**
 * Editorial grouping of the 24 published categories into four sections, used by the
 * storefronts for navigation. Categories not listed fall into "otros".
 */
export const MENU_SECTIONS = [
  { id: "para-compartir", name: "Menús y combos", categoryIds: ["combos", "menus"] },
  {
    id: "cocina-china",
    name: "Cocina china",
    categoryIds: [
      "entrantes",
      "sopas",
      "dim-sum",
      "pato",
      "pollo",
      "ternera",
      "carne",
      "marisco-y-gambas",
      "pescados-y-mariscos",
      "acompanamientos",
      "platos-combinados",
    ],
  },
  {
    id: "sushi",
    name: "Sushi",
    categoryIds: ["nigiris", "makis", "uramakis", "sushi", "temakis", "gunkan-maki", "bowls"],
  },
  { id: "bebidas", name: "Bebidas", categoryIds: ["otros", "vino-tinto", "vino-blanco", "vino-rosado"] },
] as const;

export type MenuSectionId = (typeof MENU_SECTIONS)[number]["id"];

export function sectionOfCategory(categoryId: string): MenuSectionId | "otros" {
  const section = MENU_SECTIONS.find((s) =>
    (s.categoryIds as readonly string[]).includes(categoryId),
  );
  return section?.id ?? "otros";
}

/** Display name for the "Otros" category, which on the platform only contains drinks. */
export function categoryDisplayName(categoryId: string, name: string): string {
  return categoryId === "otros" ? "Cervezas, refrescos y más" : name;
}
