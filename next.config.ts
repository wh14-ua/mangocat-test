import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tailwind v4 is processed through Turbopack (default bundler in Next 16),
  // for both `next dev` and `next build`.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // All imagery is self-hosted under /public/images, so no remotePatterns are
  // needed. We still let next/image emit modern formats.
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
