/**
 * Product photos for menu items (optional presentation layer).
 *
 * Two kinds, one registry:
 * - "ai-illustrative": generated images that show what the dish usually looks like. They
 *   are NOT photos of Shang Hai's food and are always labelled "Imagen ilustrativa".
 *   Prompts and per-dish research: SHANG_HAI_DISH_PHOTOS.md.
 * - "restaurant": the restaurant's own photos. To replace an AI image, export the new
 *   photo as `<itemId>-400.webp` and `<itemId>-800.webp` (long side; 4:3 or 1:1), put them
 *   in public/images/shang-hai/dishes/, set kind: "restaurant", update alt/size and
 *   remove `generator`. No component changes are needed.
 *
 * Items without an entry render exactly as before (text only). Prices, cart and checkout
 * never depend on this file.
 */

export type DishPhotoKind = "ai-illustrative" | "restaurant";

export type DishPhoto = {
  itemId: string;
  kind: DishPhotoKind;
  /** 800 px wide WebP (public path without basePath). */
  src: string;
  /** 400 px wide WebP. */
  srcSmall: string;
  width: number;
  height: number;
  alt: { es: string; en: string };
  focalPoint?: string;
  /** Provenance of generated images (kept for review and re-generation). */
  generator?: { tool: string; model: string; createdAt: string };
};

const AI = (model: string, createdAt: string) => ({ tool: "ElevenLabs Creative (image)", model, createdAt });

function dish(
  itemId: string,
  alt: { es: string; en: string },
  options: { kind?: DishPhotoKind; width?: number; height?: number; focalPoint?: string; generator?: DishPhoto["generator"] } = {},
): DishPhoto {
  const width = options.width ?? 800;
  return {
    itemId,
    kind: options.kind ?? "ai-illustrative",
    src: `/images/shang-hai/dishes/${itemId}-800.webp`,
    srcSmall: `/images/shang-hai/dishes/${itemId}-400.webp`,
    width,
    height: options.height ?? Math.round((width * 3) / 4),
    alt,
    ...(options.focalPoint ? { focalPoint: options.focalPoint } : {}),
    ...(options.generator ? { generator: options.generator } : {}),
  };
}

/**
 * The first 20 dishes (2026-11-05): generated with ElevenLabs Creative, model Seedream 5 Pro,
 * 2048×1152 originals cropped to 4:3. Every prompt describes only what the menu states plus
 * the dish's defining look (see SHANG_HAI_DISH_PHOTOS.md). Keyed by MenuItem.id.
 */
const SEEDREAM = AI("bytedance-seedream-5-pro", "2026-11-05");

export const DISH_PHOTOS: Record<string, DishPhoto> = Object.fromEntries(
  [
    dish("pato-a-la-pekinesa", { es: "Lonchas de pato asado con la piel brillante y crujiente sobre un plato ovalado blanco, junto a unas tortitas finas de trigo.", en: "Slices of roast duck with glossy, crisp skin on a white oval plate, next to thin wheat pancakes." }, { generator: SEEDREAM }),
    dish("rollo-de-primavera", { es: "Un rollo de primavera frito y dorado sobre un plato blanco.", en: "A golden fried spring roll on a white plate." }, { generator: SEEDREAM }),
    dish("arroz-frito-con-tres-delicias", { es: "Arroz frito tres delicias con huevo, taquitos de jamón, guisantes y zanahoria en un plato blanco.", en: "Three delights fried rice with egg, diced ham, peas and carrot on a white plate." }, { generator: SEEDREAM }),
    dish("tallarines-fritos-con-tres-delicias", { es: "Tallarines fritos con huevo, tiras de jamón, guisantes y zanahoria en un plato blanco.", en: "Fried noodles with egg, strips of ham, peas and carrot on a white plate." }, { generator: SEEDREAM }),
    dish("pollo-con-almendras", { es: "Dados de pollo salteados en salsa con almendras tostadas en un plato blanco.", en: "Diced chicken stir-fried in sauce with toasted almonds on a white plate." }, { generator: SEEDREAM }),
    dish("cerdo-con-salsa-agridulce", { es: "Trozos de cerdo rebozado cubiertos de salsa agridulce anaranjada en un plato blanco.", en: "Pieces of battered pork coated in orange sweet and sour sauce on a white plate." }, { generator: SEEDREAM }),
    dish("ternera-con-pimientos-verdes", { es: "Tiras de ternera salteadas con pimiento verde en salsa oscura en un plato blanco.", en: "Strips of beef stir-fried with green pepper in a dark sauce on a white plate." }, { generator: SEEDREAM }),
    dish("gambas-con-ajo-a-la-plancha", { es: "Gambas peladas con ajo picado sobre una plancha de hierro caliente con base de madera.", en: "Peeled prawns with chopped garlic on a hot iron sizzling plate with a wooden base." }, { generator: SEEDREAM }),
    dish("sopa-agripicante", { es: "Cuenco blanco de sopa agripicante espesa con hebras de huevo, junto a una cuchara de porcelana.", en: "White bowl of thick hot and sour soup with egg ribbons, next to a porcelain spoon." }, { generator: SEEDREAM }),
    dish("costillas-con-salsa-bbq", { es: "Costillas de cerdo glaseadas con salsa barbacoa oscura en un plato blanco.", en: "Pork ribs glazed with dark barbecue sauce on a white plate." }, { generator: SEEDREAM }),
    dish("gyozas-de-pollo-a-la-plancha", { es: "Seis gyozas doradas a la plancha en fila sobre una fuente rectangular blanca.", en: "Six griddled golden gyozas in a row on a white rectangular dish." }, { generator: SEEDREAM }),
    dish("siau-long-pao", { es: "Cuatro siau long pao con la parte superior plisada en una vaporera de bambú.", en: "Four siau long pao dumplings with pleated tops in a bamboo steamer." }, { generator: SEEDREAM }),
    dish("sau-mai", { es: "Cuatro sau mai abiertos por arriba, con masa amarilla, en una vaporera de bambú.", en: "Four open-topped sau mai with yellow wrappers in a bamboo steamer." }, { generator: SEEDREAM }),
    dish("pan-de-gambas", { es: "Cuenco blanco lleno de pan de gambas.", en: "White bowl filled with prawn crackers." }, { generator: SEEDREAM }),
    dish("gambas-en-tempura", { es: "Gambas en tempura con la cola, sobre un plato blanco.", en: "Prawns in tempura with their tails on, on a white plate." }, { generator: SEEDREAM }),
    dish("maki-salmon", { es: "Ocho piezas de maki de salmón en dos filas sobre una fuente gris oscura.", en: "Eight pieces of salmon maki in two rows on a dark grey dish." }, { generator: SEEDREAM }),
    dish("picante-atun", { es: "Ocho piezas de uramaki de atún y aguacate en dos filas sobre una fuente gris oscura.", en: "Eight pieces of tuna and avocado uramaki in two rows on a dark grey dish." }, { generator: SEEDREAM }),
    dish("nigiri-mixto", { es: "Ocho nigiris en parejas —atún, salmón, gamba y anguila— sobre una fuente gris oscura.", en: "Eight nigiri in pairs — tuna, salmon, prawn and eel — on a dark grey dish." }, { generator: SEEDREAM }),
    dish("sashimi-variado", { es: "Lonchas de sashimi de salmón y de atún en un plato blanco.", en: "Slices of salmon and tuna sashimi on a white plate." }, { generator: SEEDREAM }),
    dish("temaki-salmon", { es: "Un temaki de salmón: cono de alga nori con arroz y salmón, sobre un plato blanco.", en: "A salmon temaki: a nori cone with rice and salmon, on a white plate." }, { generator: SEEDREAM }),
  ].map((p) => [p.itemId, p]),
);

export function dishPhotoFor(itemId: string): DishPhoto | null {
  return DISH_PHOTOS[itemId] ?? null;
}

// Re-exported for the pipeline script and tests.
export { AI as aiGenerator, dish as defineDishPhoto };
