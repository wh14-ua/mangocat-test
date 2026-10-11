import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { site, theme } from "@/config";
import { cn } from "@/lib/cn";
import { SiteChrome } from "@/components/layout/SiteChrome";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});

// Fully-qualified OG/Twitter image URL. Built from `seo.url` (which includes the
// deployment sub-path) so social scrapers resolve it correctly; a relative path
// alone would be resolved against the origin root and drop the basePath.
const ogImageUrl = `${site.seo.url}${site.seo.ogImage}`;

export const metadata: Metadata = {
  metadataBase: new URL(site.seo.url),
  title: {
    default: site.seo.defaultTitle,
    template: site.seo.titleTemplate,
  },
  description: site.seo.description,
  keywords: site.seo.keywords,
  applicationName: site.name,
  authors: [{ name: site.name }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: site.seo.locale,
    url: site.seo.url,
    siteName: site.name,
    title: site.seo.defaultTitle,
    description: site.seo.description,
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: `${site.name}, ${site.cuisine} in ${site.address.city}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: site.seo.defaultTitle,
    description: site.seo.description,
    images: [ogImageUrl],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: theme.themeColor,
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn(cormorant.variable, hanken.variable)}>
      <body className="min-h-[100dvh] bg-noir font-sans text-porcelain antialiased">
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
