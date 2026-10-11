/**
 * Central map of image assets. Files live in /public/images and are curated,
 * licensed photography (see CREDITS.md). Swapping imagery for another restaurant
 * means replacing the files and, if names differ, editing the paths here only.
 */

// The site is served under a sub-path on GitHub Pages (see `basePath` in
// next.config.ts). In this version of Next, `next/image` does NOT prepend basePath
// to `src` automatically, so we apply it here, in the single place every image path
// flows through. NEXT_PUBLIC_BASE_PATH is set from `basePath` in next.config.ts and
// is "" for a root-domain deployment, where paths stay at the domain root unchanged.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const files = {
  heroDining: "/images/hero-dining.jpg",
  storyHero: "/images/story-hero.jpg",
  reservationBand: "/images/reservation-band.jpg",
  contactInterior: "/images/contact-interior.jpg",
  chefPortrait: "/images/chef-portrait.jpg",
  chefHands: "/images/chef-hands.jpg",
  kitchen: "/images/kitchen.jpg",
  dish01: "/images/dish-01.jpg",
  dish02: "/images/dish-02.jpg",
  dish03: "/images/dish-03.jpg",
  dish04: "/images/dish-04.jpg",
  dish05: "/images/dish-05.jpg",
  dish06: "/images/dish-06.jpg",
  dessert: "/images/dessert.jpg",
  produce: "/images/produce.jpg",
  wine: "/images/wine.jpg",
  tableDetail: "/images/table-detail.jpg",
  interior02: "/images/interior-02.jpg",
  detail01: "/images/detail-01.jpg",
  counter: "/images/counter.jpg",
  og: "/images/og-image.jpg",
} as const;

export type ImageKey = keyof typeof files;

/** Public-facing image paths, each prefixed with the deployment base path. */
export const images = Object.fromEntries(
  Object.entries(files).map(([key, path]) => [key, `${BASE_PATH}${path}`]),
) as Record<ImageKey, string>;
