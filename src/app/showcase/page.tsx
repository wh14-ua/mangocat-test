import type { Metadata } from "next";
import { CatalogView } from "./Catalog";

export const metadata: Metadata = {
  title: { absolute: "Design Showcase · MangoCat Studios" },
  description:
    "Cinco direcciones de diseño para un mismo restaurante. Catálogo de estilos visuales de MangoCat Studios.",
  robots: { index: true, follow: true },
};

export default function ShowcasePage() {
  return <CatalogView />;
}
