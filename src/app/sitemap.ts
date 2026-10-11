import type { MetadataRoute } from "next";
import { site } from "@/config";

// Prerender to a static sitemap.xml at build time (required with `output: 'export'`).
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/story", "/menu", "/gallery", "/reservations", "/contact"];
  const now = new Date();
  return routes.map((r) => ({
    url: `${site.seo.url}${r}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: r === "" ? 1 : 0.8,
  }));
}
