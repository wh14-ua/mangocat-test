import { shangHaiCatalog, sectionOfCategory, type MenuSectionId } from "@/lib/shang-hai/catalog";
import { categoryName, sectionName } from "@/lib/shang-hai/menu-i18n";
import { INK_TEXT } from "@/lib/shang-hai/i18n/ink-house";
import type { Locale } from "@/lib/i18n/locale";
import type { MenuCategory, MenuItem } from "@/lib/commerce/types";

/**
 * The carta as a book: the restaurant's 24 categories become numbered chapters (in the
 * restaurant's own order) grouped into four parts. In that order the four editorial
 * sections are contiguous, so every part is one uninterrupted run of chapters.
 * Titles are read in the visitor's language through the helpers below.
 */
export type Chapter = {
  number: string;
  id: string;
  anchor: string;
  category: MenuCategory;
  items: MenuItem[];
};

export type Part = {
  id: MenuSectionId | "otros";
  /** 0-based position in the book (first part, second part…). */
  position: number;
  chapters: Chapter[];
};

export const CHAPTERS: Chapter[] = shangHaiCatalog.sections.map(({ category, items }, i) => ({
  number: String(i + 1).padStart(2, "0"),
  id: category.id,
  anchor: `cap-${category.id}`,
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
  parts.push({ id: sectionId, position: parts.length, chapters: [chapter] });
  return parts;
}, []);

export const CHAPTER_BY_CATEGORY = new Map(CHAPTERS.map((c) => [c.id, c]));

export const VISIBLE_DISH_COUNT = shangHaiCatalog.visibleItems.length;

export function chapterTitle(chapter: Chapter, locale: Locale): string {
  return categoryName(chapter.category, locale);
}

/**
 * The quiet second line under a chapter title: the other language's name, only for the
 * chapters the restaurant itself also named in English (as in the approved design).
 */
export function chapterAltTitle(chapter: Chapter, locale: Locale): string | null {
  if (!chapter.category.nameEn) return null;
  const other = categoryName(chapter.category, locale === "es" ? "en" : "es");
  return other !== chapterTitle(chapter, locale) ? other : null;
}

export function partTitle(part: Part, locale: Locale): string {
  return sectionName(part.id, locale);
}

export function partOrdinal(part: Part, locale: Locale): string {
  const t = INK_TEXT[locale].carta;
  return t.partOrdinals[part.position] ?? t.partFallback(part.position + 1);
}
