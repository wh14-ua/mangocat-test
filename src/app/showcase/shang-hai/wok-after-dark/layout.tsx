import type { Metadata, Viewport } from "next";
import { Archivo, Big_Shoulders } from "next/font/google";
import { StorefrontShell } from "@/components/shang-hai/shared/StorefrontShell";
import "@/components/shang-hai/wok-after-dark/wok.css";

// Gigantic poster type: Big Shoulders with its optical-size axis (the 72 opsz cut is
// drawn for display). Interface text: Archivo with its width axis, used condensed for
// ticket labels and at normal width for reading.
const display = Big_Shoulders({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-wok-display",
  display: "swap",
});
const text = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  style: ["normal", "italic"],
  variable: "--font-wok-text",
  display: "swap",
});

export const metadata: Metadata = {
  title: { absolute: "SHANG HAI · Restaurante Asiático en Orihuela — Propuesta 02 · Wok After Dark" },
  description:
    "Cocina china y sushi para recoger en Orihuela: carta completa, pedido online y pago seguro. Propuesta de MangoCat Studios para Shang Hai.",
};

export const viewport: Viewport = { themeColor: "#101E24", colorScheme: "dark" };

export default function WokAfterDarkLayout({ children }: { children: React.ReactNode }) {
  return (
    <StorefrontShell storefront="wok-after-dark" className={`wok ${display.variable} ${text.variable}`}>
      {children}
    </StorefrontShell>
  );
}
