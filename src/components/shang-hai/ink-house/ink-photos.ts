import { shangHaiPhotos } from "@/data/shang-hai/photos";
import type { PhotoLike } from "@/components/shang-hai/shared/ShPhoto";

/**
 * INK HOUSE photography (provisional, illustrative; see CREDITS.md). Every slot is
 * optional so a missing image falls back to a paper-toned frame instead of breaking.
 */
export const inkPhotos: Partial<Record<"hero" | "tea" | "dimsum" | "sushi", PhotoLike>> =
  shangHaiPhotos.inkHouse;
