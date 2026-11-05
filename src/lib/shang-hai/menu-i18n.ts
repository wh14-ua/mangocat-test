import { MENU_EN } from "../../data/shang-hai/menu-translations";
import type { Locale } from "../i18n/locale";
import { formatPieces } from "../i18n/format";
import type { MenuCategory, MenuItem, OptionChoice, PricedLine, ProductOption } from "../commerce/types";
import { categoryDisplayName, MENU_SECTIONS, shangHaiCatalog, type MenuSectionId } from "./catalog";

/**
 * Menu text in the visitor's language. Spanish is what the restaurant published; English
 * comes from MENU_EN (curated, see src/data/shang-hai/menu-translations.ts), then from the
 * English the restaurant published on Just Eat (`nameEn` / `descriptionEn`), and only as a
 * last resort from the Spanish text. Framework-agnostic: the Worker uses it too.
 */

export function itemName(item: MenuItem, locale: Locale): string {
  if (locale === "es") return item.name;
  return MENU_EN.items[item.id]?.name ?? item.nameEn ?? item.name;
}

/** The other language's name, for bilingual layouts ("Pollo con Almendras · Chicken with almonds"). */
export function itemAltName(item: MenuItem, locale: Locale): string | null {
  const other = itemName(item, locale === "es" ? "en" : "es");
  return other !== itemName(item, locale) ? other : null;
}

export function itemDescription(item: MenuItem, locale: Locale): string | undefined {
  if (locale === "es") return item.description;
  if (!item.description && !item.descriptionEn && !MENU_EN.items[item.id]?.description) return undefined;
  return MENU_EN.items[item.id]?.description ?? item.descriptionEn ?? item.description;
}

/** "8 piezas" / "8 pieces", or null when the catalog has no piece count. */
export function itemPieces(item: MenuItem, locale: Locale): string | null {
  return item.pieces ? formatPieces(item.pieces.count, item.pieces.unit, locale) : null;
}

/** "Maki Salmón (8 piezas)" / "Salmon maki (8 pieces)" — receipts, cart lines, Stripe. */
export function itemFullName(item: MenuItem, locale: Locale): string {
  const pieces = itemPieces(item, locale);
  return pieces ? `${itemName(item, locale)} (${pieces})` : itemName(item, locale);
}

export function categoryName(category: MenuCategory, locale: Locale): string {
  if (locale === "es") return categoryDisplayName(category.id, category.name);
  return MENU_EN.categories[category.id] ?? category.nameEn ?? category.name;
}

export function categoryNameById(categoryId: string, locale: Locale): string {
  const category = shangHaiCatalog.categoryById.get(categoryId);
  return category ? categoryName(category, locale) : categoryId;
}

export function sectionName(sectionId: MenuSectionId | "otros", locale: Locale): string {
  if (locale === "en") return MENU_EN.sections[sectionId] ?? sectionId;
  return MENU_SECTIONS.find((s) => s.id === sectionId)?.name ?? "Otros";
}

export function optionName(option: ProductOption, locale: Locale): string {
  return locale === "en" ? MENU_EN.options[option.id] ?? option.name : option.name;
}

export function choiceName(choice: OptionChoice, locale: Locale): string {
  if (locale === "es") return choice.name;
  return MENU_EN.choices[choice.id] ?? choice.nameEn ?? choice.name;
}

/** "Con postre" / "With dessert" for a set of selections of a catalog item. */
export function selectionsLabel(item: MenuItem, selections: Record<string, string[]>, locale: Locale): string | undefined {
  const names = (item.options ?? []).flatMap((option) =>
    (selections[option.id] ?? [])
      .map((id) => option.choices.find((c) => c.id === id))
      .filter((c): c is OptionChoice => Boolean(c))
      .map((c) => choiceName(c, locale)),
  );
  return names.length ? names.join(", ") : undefined;
}

/**
 * Display name of a priced line (cart, order status). Orders store the Spanish name
 * confirmed at purchase; when the item is still in the catalog we show it in the
 * visitor's language, otherwise the stored name.
 */
export function lineName(line: Pick<PricedLine, "itemId" | "name">, locale: Locale): string {
  const item = shangHaiCatalog.byId.get(line.itemId);
  return item ? itemFullName(item, locale) : line.name;
}

export function lineOptionsLabel(
  line: Pick<PricedLine, "itemId" | "optionsLabel" | "selections">,
  locale: Locale,
): string | undefined {
  const item = shangHaiCatalog.byId.get(line.itemId);
  if (!item || !line.selections) return line.optionsLabel;
  return selectionsLabel(item, line.selections, locale) ?? line.optionsLabel;
}
