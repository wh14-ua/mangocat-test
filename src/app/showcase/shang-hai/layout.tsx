import type { Metadata } from "next";

/**
 * Shang Hai proposals (MangoCat Studios). These are sales demos of a real restaurant,
 * not its official website, so the whole segment is noindex/nofollow. When the owner
 * chooses a proposal it moves to its own domain with indexable metadata, sitemap and
 * Restaurant JSON-LD built from src/data/shang-hai/restaurant.ts.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  // The order status page carries the order's access token in its URL (?t=): never leak it
  // to another site through the Referer header.
  referrer: "no-referrer",
};

export default function ShangHaiLayout({ children }: { children: React.ReactNode }) {
  return children;
}
