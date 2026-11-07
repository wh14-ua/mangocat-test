"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";
import { dishPhotoFor, type DishPhoto as DishPhotoEntry } from "@/data/shang-hai/dish-photos";
import { useLocale } from "@/hooks/shang-hai/useLocale";
import { asset } from "@/lib/shang-hai/paths";

/**
 * Dish photos are an optional presentation of the same catalog: OFF by default (the
 * approved designs are text-led), switched on per visit with `?fotos=1` (and off with
 * `?fotos=0`), or for a whole build with NEXT_PUBLIC_SHANG_HAI_DISH_PHOTOS=on. The choice
 * from the URL is kept for the rest of the tab session so it survives navigation to the
 * checkout and back. Nothing about the cart, prices or checkout depends on it.
 */

export const DISH_PHOTOS_QUERY_PARAM = "fotos";
const SESSION_KEY = "mangocat:shang-hai:dish-photos:v1";

export const DISH_PHOTOS_BUILD_DEFAULT =
  (process.env.NEXT_PUBLIC_SHANG_HAI_DISH_PHOTOS ?? "").trim().toLowerCase() === "on";

export function parseDishPhotosParam(value: string | null): boolean | null {
  if (value === null) return null;
  const v = value.trim().toLowerCase();
  if (["1", "on", "si", "sí", "true", "yes"].includes(v)) return true;
  if (["0", "off", "no", "false"].includes(v)) return false;
  return null;
}

let current: boolean | null = null;

function readEnabled(): boolean {
  if (current !== null) return current;
  let value = DISH_PHOTOS_BUILD_DEFAULT;
  try {
    const fromUrl = parseDishPhotosParam(new URLSearchParams(window.location.search).get(DISH_PHOTOS_QUERY_PARAM));
    if (fromUrl !== null) {
      value = fromUrl;
      window.sessionStorage.setItem(SESSION_KEY, fromUrl ? "1" : "0");
    } else {
      const saved = parseDishPhotosParam(window.sessionStorage.getItem(SESSION_KEY));
      if (saved !== null) value = saved;
    }
  } catch {
    /* storage blocked: the URL or the build default decides */
  }
  current = value;
  return value;
}

const noopSubscribe = () => () => {};

const DishPhotosContext = createContext<boolean>(false);

export function DishPhotosProvider({ children }: { children: React.ReactNode }) {
  const enabled = useSyncExternalStore(noopSubscribe, readEnabled, () => DISH_PHOTOS_BUILD_DEFAULT);
  return <DishPhotosContext.Provider value={enabled}>{children}</DishPhotosContext.Provider>;
}

/** `photoFor(item.id)` returns the photo to show, or null (photos off, or none for that dish). */
export function useDishPhotos() {
  const enabled = useContext(DishPhotosContext);
  return {
    enabled,
    photoFor: (itemId: string): DishPhotoEntry | null => (enabled ? dishPhotoFor(itemId) : null),
  };
}

export const ILLUSTRATIVE_LABEL = { es: "Imagen ilustrativa", en: "Illustrative image" } as const;

/**
 * Lazy, responsive WebP of a dish with its honesty label. Styling is the storefront's:
 * `className` on the <figure>, `imgClassName` on the image, `labelClassName` on the label.
 * The label is visible for generated images and omitted for the restaurant's own photos.
 */
export function DishPhoto({
  photo,
  sizes = "(min-width: 1024px) 320px, 45vw",
  className,
  imgClassName,
  labelClassName,
  style,
  decorative = false,
}: {
  photo: DishPhotoEntry;
  sizes?: string;
  className?: string;
  imgClassName?: string;
  labelClassName?: string;
  style?: CSSProperties;
  /** The dish name is already next to the image: hide the alt text from screen readers. */
  decorative?: boolean;
}) {
  const { locale } = useLocale();
  return (
    <figure className={className} style={style} data-dish-photo={photo.itemId} data-kind={photo.kind}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static export: pre-sized WebP srcset */}
      <img
        src={asset(photo.src)}
        srcSet={`${asset(photo.srcSmall)} 400w, ${asset(photo.src)} 800w`}
        sizes={sizes}
        width={photo.width}
        height={photo.height}
        alt={decorative ? "" : photo.alt[locale]}
        loading="lazy"
        decoding="async"
        className={imgClassName}
        style={photo.focalPoint ? { objectPosition: photo.focalPoint } : undefined}
      />
      {photo.kind === "ai-illustrative" && (
        <figcaption className={labelClassName} data-testid="dish-photo-label">
          {ILLUSTRATIVE_LABEL[locale]}
        </figcaption>
      )}
    </figure>
  );
}
