import { shangHaiCatalog, MENU_SECTIONS, sectionOfCategory, categoryDisplayName } from "@/lib/shang-hai/catalog";
import type { MenuCategory, MenuItem } from "@/lib/commerce/types";

/**
 * The carta as a book: the restaurant's 24 categories become numbered chapters (in the
 * restaurant's own order) grouped into four parts. In that order the four editorial
 * sections are contiguous, so every part is one uninterrupted run of chapters.
 */
export type Chapter = {
  number: string;
  id: string;
  anchor: string;
  title: string;
  titleEn?: string;
  category: MenuCategory;
  items: MenuItem[];
};

export type Part = {
  id: string;
  ordinal: string;
  title: string;
  chapters: Chapter[];
};

const ORDINALS = ["Primera parte", "Segunda parte", "Tercera parte", "Cuarta parte", "Quinta parte"];

export const CHAPTERS: Chapter[] = shangHaiCatalog.sections.map(({ category, items }, i) => ({
  number: String(i + 1).padStart(2, "0"),
  id: category.id,
  anchor: `cap-${category.id}`,
  title: categoryDisplayName(category.id, category.name),
  titleEn: category.nameEn,
  category,
  items,
}));

export const PARTS: Part[] = CHAPTERS.reduce<Part[]>((parts, chapter) => {
  const sectionId = sectionOfCategory(chapter.id);
  const last = parts.at(-1);
  if (last && last.id === sectionId) {
    last.chapters.push(chapter);
    return parts;
  }
  const section = MENU_SECTIONS.find((s) => s.id === sectionId);
  parts.push({
    id: sectionId,
    ordinal: ORDINALS[parts.length] ?? `Parte ${parts.length + 1}`,
    title: section?.name ?? "Otros",
    chapters: [chapter],
  });
  return parts;
}, []);

export const CHAPTER_BY_CATEGORY = new Map(CHAPTERS.map((c) => [c.id, c]));

export const VISIBLE_DISH_COUNT = shangHaiCatalog.visibleItems.length;

export function platosLabel(n: number): string {
  return `${n} ${n === 1 ? "plato" : "platos"}`;
}
