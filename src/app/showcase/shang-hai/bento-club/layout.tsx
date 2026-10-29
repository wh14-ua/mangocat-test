import type { Metadata, Viewport } from "next";
import { Dela_Gothic_One, Rethink_Sans } from "next/font/google";
import { StorefrontShell } from "@/components/shang-hai/shared/StorefrontShell";
import "@/components/shang-hai/bento-club/bento.css";

/*
 * BENTO CLUB — Shang Hai proposal 03 by MangoCat Studios.
 * Dela Gothic One (packaging headlines) + Rethink Sans (compact commerce UI).
 */
const display = Dela_Gothic_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bc-display",
  display: "swap",
});
const text = Rethink_Sans({
  subsets: ["latin"],
  variable: "--font-bc-text",
  display: "swap",
});

export const metadata: Metadata = {
  title: { absolute: "SHANG HAI · Restaurante Asiático en Orihuela — Propuesta 03 · Bento Club" },
  description:
    "Propuesta 03 de MangoCat Studios para Restaurante Shang Hai (Orihuela): toda la carta en una caja de bento, búsqueda inmediata y pedidos para recoger en pocos toques.",
};

export const viewport: Viewport = {
  themeColor: "#FFF8EA",
  colorScheme: "light",
};

export default function BentoClubLayout({ children }: { children: React.ReactNode }) {
  return (
    <StorefrontShell storefront="bento-club" className={`bc-root ${display.variable} ${text.variable}`}>
      {children}
    </StorefrontShell>
  );
}
