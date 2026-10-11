import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { site, theme } from "@/config";
import { cn } from "@/lib/cn";
import { SkipLink } from "@/components/layout/SkipLink";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { StructuredData } from "@/components/layout/StructuredData";

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
        url: site.seo.ogImage,
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
    images: [site.seo.ogImage],
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
        <SkipLink />
        <Nav />
        <main id="main" tabIndex={-1} className="outline-none">
          {children}
        </main>
        <Footer />
        <StructuredData />
      </body>
    </html>
  );
}
