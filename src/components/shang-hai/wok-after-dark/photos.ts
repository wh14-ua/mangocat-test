import { shangHaiPhotos, type Photo } from "@/data/shang-hai/photos";

/** Wok After Dark photo slots. Provisional, illustrative, licensed (see /creditos/). */
export type WokPhotoSlot = "fire" | "noodles" | "dumplings" | "sushi" | "street";

export const wokPhotos: Partial<Record<WokPhotoSlot, Photo>> = shangHaiPhotos.wokAfterDark;
