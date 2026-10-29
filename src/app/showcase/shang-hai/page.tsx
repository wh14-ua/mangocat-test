import type { Metadata, Viewport } from "next";
import { ComparePage } from "@/components/shang-hai/compare/ComparePage";

/**
 * Client-facing comparison page for the three Shang Hai proposals. noindex (inherited):
 * it is a private proposal for a real business, shared by link only.
 */
export const metadata: Metadata = {
  title: { absolute: "SHANG HAI — Tres visiones, una identidad · MangoCat Studios" },
  description:
    "Tres propuestas digitales creadas por MangoCat Studios para Restaurante Shang Hai, Orihuela.",
};

export const viewport: Viewport = { themeColor: "#f6f4ef", colorScheme: "light" };

export default function ShangHaiComparePage() {
  return <ComparePage />;
}
