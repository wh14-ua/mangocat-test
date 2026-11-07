import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DISH_PHOTOS } from "@/data/shang-hai/dish-photos";
import { parseDishPhotosParam } from "@/components/shang-hai/shared/DishPhotos";
import { shangHaiCatalog } from "@/lib/shang-hai/catalog";

const PUBLIC = new URL("../../../public", import.meta.url);

/** Width and height of a WebP file (lossy VP8, lossless VP8L or extended VP8X). */
function webpSize(file: string): { width: number; height: number } {
  const b = readFileSync(file);
  expect(b.toString("ascii", 0, 4)).toBe("RIFF");
  expect(b.toString("ascii", 8, 12)).toBe("WEBP");
  const chunk = b.toString("ascii", 12, 16);
  if (chunk === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  if (chunk === "VP8L") {
    const bits = b.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") return { width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
  throw new Error(`Unknown WebP chunk ${chunk}`);
}

describe("dish photos", () => {
  const photos = Object.values(DISH_PHOTOS);

  it("covers the first 20 representative dishes, all real and orderable", () => {
    expect(photos).toHaveLength(20);
    for (const photo of photos) {
      const item = shangHaiCatalog.byId.get(photo.itemId);
      expect(item, photo.itemId).toBeDefined();
      expect(shangHaiCatalog.visibleItems.includes(item!), photo.itemId).toBe(true);
    }
  });

  it("ships lazy-friendly WebP files at the declared sizes, small enough for mobile", () => {
    for (const photo of photos) {
      const large = new URL(`.${photo.src}`, `${PUBLIC.href}/`).pathname;
      const small = new URL(`.${photo.srcSmall}`, `${PUBLIC.href}/`).pathname;
      expect(webpSize(large)).toEqual({ width: photo.width, height: photo.height });
      expect(webpSize(small)).toEqual({ width: 400, height: 300 });
      expect(statSync(large).size, photo.itemId).toBeLessThan(80_000);
      expect(statSync(small).size, photo.itemId).toBeLessThan(30_000);
    }
  });

  it("labels every generated image and describes it in both languages", () => {
    for (const photo of photos) {
      expect(photo.kind).toBe("ai-illustrative");
      expect(photo.generator?.model).toBe("bytedance-seedream-5-pro");
      expect(photo.alt.es.length).toBeGreaterThan(20);
      expect(photo.alt.en.length).toBeGreaterThan(20);
      expect(photo.alt.es).not.toBe(photo.alt.en);
    }
  });

  it("parses the ?fotos= switch", () => {
    for (const on of ["1", "on", "si", "sí", "true", "yes"]) expect(parseDishPhotosParam(on)).toBe(true);
    for (const off of ["0", "off", "no", "false"]) expect(parseDishPhotosParam(off)).toBe(false);
    expect(parseDishPhotosParam(null)).toBeNull();
    expect(parseDishPhotosParam("maybe")).toBeNull();
  });
});
