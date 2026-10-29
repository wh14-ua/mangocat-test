import type { Metadata, Viewport } from "next";
import { Albert_Sans, Gloock } from "next/font/google";
import { StorefrontShell } from "@/components/shang-hai/shared/StorefrontShell";
import { InkUIProvider } from "@/components/shang-hai/ink-house/InkUI";
import { InkCartDrawer } from "@/components/shang-hai/ink-house/InkCartDrawer";
import { InkOptionDialog } from "@/components/shang-hai/ink-house/InkOptionDialog";
import { InkDefs } from "@/components/shang-hai/ink-house/Seal";
import "@/components/shang-hai/ink-house/ink.css";

/** Display face: high-contrast editorial serif for the brand, chapters and numerals. */
const gloock = Gloock({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  variable: "--ink-font-display",
  display: "swap",
});

/** Text face: a calm, very legible sans for dishes, prices and every control. */
const albert = Albert_Sans({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  variable: "--ink-font-text",
  display: "swap",
});

export const metadata: Metadata = {
  title: { absolute: "SHANG HAI · Restaurante Asiático en Orihuela — Propuesta 01 · Ink House" },
  description:
    "Propuesta 01 de MangoCat Studios para SHANG HAI, restaurante asiático en Orihuela: la carta completa como un libro editorial y pedidos online para recoger.",
};

export const viewport: Viewport = {
  themeColor: "#F1EDE3",
  colorScheme: "light",
};

export default function InkHouseLayout({ children }: { children: React.ReactNode }) {
  return (
    <StorefrontShell storefront="ink-house" className={`ink-root ${gloock.variable} ${albert.variable}`}>
      <InkDefs />
      <InkUIProvider>
        {children}
        <InkCartDrawer />
        <InkOptionDialog />
      </InkUIProvider>
    </StorefrontShell>
  );
}
