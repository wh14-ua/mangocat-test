import { describe, expect, it } from "vitest";
import { parseLocale, type Messages } from "@/lib/i18n/locale";
import { formatClock, formatMoney, formatPieces } from "@/lib/i18n/format";
import {
  CHECKOUT_ERROR_TEXT,
  NOT_ORDERABLE_TEXT,
  ORDER_STATUS_TEXT,
  PAYMENT_STATUS_TEXT,
  QUOTE_ISSUE_TEXT,
  VALIDATION_TEXT,
} from "@/lib/commerce/messages";
import { ORDER_VIEW_TEXT } from "@/lib/commerce/order-view";
import { validateCustomer } from "@/lib/commerce/validation";
import { formatWeek } from "@/lib/commerce/hours";
import { COMMON_TEXT } from "@/lib/shang-hai/i18n/common";
import { shangHaiCatalog, shangHaiOrdering } from "@/lib/shang-hai/catalog";
import {
  categoryName,
  choiceName,
  itemDescription,
  itemFullName,
  itemName,
  lineName,
  sectionName,
} from "@/lib/shang-hai/menu-i18n";
import { MENU_SECTIONS } from "@/lib/shang-hai/catalog";
import { MENU_EN } from "@/data/shang-hai/menu-translations";

/** Every leaf of `es` exists in `en` with the same kind (string / function), and vice versa. */
function leaves(value: unknown, path = ""): Map<string, unknown> {
  const out = new Map<string, unknown>();
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) {
      for (const [p, leaf] of leaves(v, path ? `${path}.${k}` : k)) out.set(p, leaf);
    }
  } else out.set(path, value);
  return out;
}

export function expectParity<T>(messages: Messages<T>, name: string) {
  const es = leaves(messages.es);
  const en = leaves(messages.en);
  expect([...en.keys()].sort(), `${name}: same keys`).toEqual([...es.keys()].sort());
  let identical = 0;
  for (const [path, value] of es) {
    const other = en.get(path);
    expect(typeof other, `${name}.${path}: same kind`).toBe(typeof value);
    if (typeof value === "string") {
      expect(value.trim(), `${name}.${path}: es not empty`).not.toBe("");
      expect(String(other).trim(), `${name}.${path}: en not empty`).not.toBe("");
      if (value === other) identical += 1;
    }
  }
  // Catches a dictionary copied without translating (a few identical words are fine).
  expect(identical, `${name}: too many identical strings`).toBeLessThanOrEqual(Math.max(3, es.size * 0.15));
}

describe("locales", () => {
  it("parses language tags and rejects anything else", () => {
    expect(parseLocale("es")).toBe("es");
    expect(parseLocale("EN")).toBe("en");
    expect(parseLocale("en-GB")).toBe("en");
    expect(parseLocale("es_ES")).toBe("es");
    expect(parseLocale("fr")).toBeNull();
    expect(parseLocale("")).toBeNull();
    expect(parseLocale(undefined)).toBeNull();
    expect(parseLocale("<script>")).toBeNull();
  });

  it("formats money, times and pieces per language (Madrid time)", () => {
    expect(formatMoney(1945, "es")).toBe("19,45\u00a0€");
    expect(formatMoney(1945, "en")).toBe("€19.45");
    expect(formatClock("2026-11-05T12:42:00Z", "es")).toBe("13:42");
    expect(formatClock("2026-11-05T12:42:00Z", "en")).toBe("13:42");
    expect(formatPieces(8, "piezas", "es")).toBe("8 piezas");
    expect(formatPieces(2, "unidades", "en")).toBe("2 pieces");
    expect(formatPieces(1, "piezas", "en")).toBe("1 piece");
  });

  it("keeps every dictionary complete in both languages", () => {
    expectParity(ORDER_STATUS_TEXT, "ORDER_STATUS_TEXT");
    expectParity(PAYMENT_STATUS_TEXT, "PAYMENT_STATUS_TEXT");
    expectParity(CHECKOUT_ERROR_TEXT, "CHECKOUT_ERROR_TEXT");
    expectParity(QUOTE_ISSUE_TEXT, "QUOTE_ISSUE_TEXT");
    expectParity(NOT_ORDERABLE_TEXT, "NOT_ORDERABLE_TEXT");
    expectParity(VALIDATION_TEXT, "VALIDATION_TEXT");
    expectParity(ORDER_VIEW_TEXT, "ORDER_VIEW_TEXT");
    expectParity(COMMON_TEXT, "COMMON_TEXT");
  });

  it("validates in the customer's language with the same rules", () => {
    const es = validateCustomer({ name: "", phone: "12", email: "x" }, shangHaiOrdering.limits, "es");
    const en = validateCustomer({ name: "", phone: "12", email: "x" }, shangHaiOrdering.limits, "en");
    expect(es.ok || en.ok).toBe(false);
    if (es.ok || en.ok) return;
    expect(Object.keys(en.errors).sort()).toEqual(Object.keys(es.errors).sort());
    expect(en.errors.phone).toBe("Please check the phone number, for example 612 345 678.");
    expect(es.errors.phone).toBe("Revisa el teléfono: por ejemplo 612 345 678.");
  });

  it("formats the week in both languages", () => {
    expect(formatWeek(shangHaiOrdering.hours, "en")[1]).toEqual({ day: "Tuesday", text: "Closed" });
    expect(formatWeek(shangHaiOrdering.hours, "es")[0].day).toBe("Lunes");
  });
});

describe("menu translations", () => {
  const visible = shangHaiCatalog.visibleItems;
  const untranslated = new Set(MENU_EN.untranslatedNames);

  it("gives every visible dish an English name (proper names excepted)", () => {
    const missing = visible.filter((i) => itemName(i, "en") === i.name && !untranslated.has(i.id)).map((i) => i.id);
    expect(missing).toEqual([]);
  });

  it("translates every description, category, section and option choice", () => {
    for (const item of visible) {
      if (item.description) {
        expect(itemDescription(item, "en"), item.id).toBeTruthy();
        expect(itemDescription(item, "en"), item.id).not.toBe(item.description === "Sau mai" ? "x" : item.description);
      }
    }
    for (const category of shangHaiCatalog.catalog.categories) {
      expect(categoryName(category, "en"), category.id).not.toBe("");
      expect(MENU_EN.categories[category.id] ?? category.nameEn, category.id).toBeTruthy();
    }
    for (const section of MENU_SECTIONS) expect(sectionName(section.id, "en")).not.toBe(section.name === "Sushi" ? "x" : section.name);
    for (const item of visible) {
      for (const option of item.options ?? []) {
        for (const choice of option.choices) expect(choiceName(choice, "en")).toMatch(/^With /);
      }
    }
  });

  it("only overlays ids that exist in the catalog", () => {
    const ids = new Set(shangHaiCatalog.catalog.items.map((i) => i.id));
    expect(Object.keys(MENU_EN.items).filter((id) => !ids.has(id))).toEqual([]);
    expect(Object.keys(MENU_EN.overrides).filter((id) => !ids.has(id))).toEqual([]);
    const categories = new Set(shangHaiCatalog.catalog.categories.map((c) => c.id));
    expect(Object.keys(MENU_EN.categories).filter((id) => !categories.has(id))).toEqual([]);
  });

  it("never translates brand names and keeps Spanish untouched", () => {
    const freixenet = shangHaiCatalog.byId.get("freixenet-cava-brut")!;
    expect(itemName(freixenet, "en")).toBe("Freixenet Cava Brut");
    expect(itemName(shangHaiCatalog.byId.get("vino-tinto-campo-viejo")!, "en")).toBe("Campo Viejo red wine");
    for (const item of visible) expect(itemName(item, "es")).toBe(item.name);
  });

  it("builds full names with pieces and localises stored order lines", () => {
    const maki = shangHaiCatalog.byId.get("maki-salmon")!;
    expect(itemFullName(maki, "es")).toBe("Maki Salmón (8 piezas)");
    expect(itemFullName(maki, "en")).toBe("Salmon maki (8 pieces)");
    expect(lineName({ itemId: "maki-salmon", name: "Maki Salmón (8 piezas)" }, "en")).toBe("Salmon maki (8 pieces)");
    expect(lineName({ itemId: "gone-from-menu", name: "Plato antiguo" }, "en")).toBe("Plato antiguo");
  });

  it("finds dishes by their English names", () => {
    expect(shangHaiCatalog.search("peking duck").map((i) => i.id)).toContain("pato-a-la-pekinesa");
    expect(shangHaiCatalog.search("salmon maki")[0]?.id).toBe("maki-salmon");
    expect(shangHaiCatalog.search("prawn crackers").map((i) => i.id)).toContain("pan-de-gambas");
    // Spanish search keeps working as before.
    expect(shangHaiCatalog.search("pato pekin")[0]?.id).toBe("pato-a-la-pekinesa");
  });
});
