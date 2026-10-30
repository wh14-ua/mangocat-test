import { shangHaiPhotos } from "@/data/shang-hai/photos";
import type { PhotoLike } from "@/components/shang-hai/shared/ShPhoto";

/** Wok After Dark photo slots. Provisional, illustrative, licensed (see /creditos/). */
export type WokPhotoSlot = "fire" | "noodles" | "dumplings" | "sushi" | "street";

export const wokPhotos: Partial<Record<WokPhotoSlot, PhotoLike>> = shangHaiPhotos.wokAfterDark;
