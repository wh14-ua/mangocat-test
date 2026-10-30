import type { CSSProperties } from "react";
import { asset } from "@/lib/shang-hai/paths";

export type PhotoLike = {
  src: string;
  srcSmall?: string;
  srcLarge?: string;
  width: number;
  height: number;
  alt: string;
  focalPoint?: string;
};

/**
 * Responsive photo for the Shang Hai storefronts. The site is a static export (no image
 * optimizer), so sizes are pre-generated (-800 / -1600 / -2400 .webp) and chosen by the
 * browser through srcset. Lazy by default; pass priority for the hero image only.
 */
export function ShPhoto({
  photo,
  sizes = "100vw",
  priority = false,
  className,
  style,
  alt,
}: {
  photo: PhotoLike;
  sizes?: string;
  priority?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Override alt (use "" for purely decorative placements). */
  alt?: string;
}) {
  const srcSet = [
    photo.srcSmall ? `${asset(photo.srcSmall)} 800w` : null,
    `${asset(photo.src)} 1600w`,
    photo.srcLarge ? `${asset(photo.srcLarge)} 2400w` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static export: pre-sized srcset
    <img
      src={asset(photo.src)}
      srcSet={srcSet}
      sizes={sizes}
      width={photo.width}
      height={photo.height}
      alt={alt ?? photo.alt}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
      className={className}
      style={{ objectPosition: photo.focalPoint, ...style }}
    />
  );
}
