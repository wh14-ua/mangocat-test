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

/** Filled by the photo pipeline (see SHANG_HAI_DISH_PHOTOS.md). Keyed by MenuItem.id. */
export const DISH_PHOTOS: Record<string, DishPhoto> = Object.fromEntries(
  [
    // TEMPORARY layout placeholders, replaced by the generated photos (same ids and files).
    dish("pato-a-la-pekinesa", { es: "Imagen provisional", en: "Placeholder image" }),
    dish("maki-salmon", { es: "Imagen provisional", en: "Placeholder image" }),
  ].map((p) => [p.itemId, p]),
);

export function dishPhotoFor(itemId: string): DishPhoto | null {
  return DISH_PHOTOS[itemId] ?? null;
}

// Re-exported for the pipeline script and tests.
export { AI as aiGenerator, dish as defineDishPhoto };
