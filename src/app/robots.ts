import type { MetadataRoute } from "next";
import { site } from "@/config";

// Prerender to a static robots.txt at build time (required with `output: 'export'`).
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${site.seo.url}/sitemap.xml`,
    host: site.seo.url,
  };
}
