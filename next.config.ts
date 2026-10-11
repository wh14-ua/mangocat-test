import type { NextConfig } from "next";

/**
 * Deployment base path for the GitHub Pages *project* site.
 *
 * The site is published at https://wh14-ua.github.io/mangocat-test/, i.e. under
 * the "/mangocat-test" sub-path, so the app has to know that prefix at build time.
 * This MUST match the repository name and `seo.url` in src/config/site.ts.
 *
 * Deploying to a root domain later? Set this to "" (and update `seo.url`); every
 * link and image path then resolves at the domain root with no other changes.
 */
const basePath = "/mangocat-test";

const nextConfig: NextConfig = {
  // Emit a fully static site to ./out that any static host (GitHub Pages) can serve.
  output: "export",

  // Served from a sub-path. Next prefixes this onto next/link hrefs, the
  // next/navigation router, the font files and the _next/* assets automatically.
  basePath,

  // Exposed to the app (client + server) so the image map in src/config/images.ts
  // can prefix basePath onto next/image `src` values, which Next does NOT do
  // automatically. Single source of truth: the `basePath` const above.
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },

  // Export each route as <route>/index.html (not <route>.html) so GitHub Pages
  // resolves directory-style URLs such as /mangocat-test/menu/ reliably.
  trailingSlash: true,

  // Tailwind v4 is processed through Turbopack (the default bundler in Next 16),
  // for both `next dev` and `next build`.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  // The built-in next/image optimizer requires a Node server, which a static
  // export does not have. All imagery is self-hosted under /public/images, so we
  // serve the original files as-is. next/image still handles sizing, lazy-loading
  // and layout stability, and basePath is applied to each image `src` automatically.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
