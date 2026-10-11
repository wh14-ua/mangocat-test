import type { Metadata } from "next";
import { MenuHeader } from "@/components/sections/menu/MenuHeader";
import { TastingFeature } from "@/components/sections/menu/TastingFeature";
import { MenuBrowser } from "@/components/sections/menu/MenuBrowser";

export const metadata: Metadata = {
  title: "Menu",
  description:
    "The ATELIER menu, written each week from the market: a seven-course tasting menu and a seasonal carte, with dietary and allergen information.",
  alternates: { canonical: "/menu" },
};

export default function MenuPage() {
  return (
    <>
      <MenuHeader />
      <TastingFeature />
      <MenuBrowser />
    </>
  );
}
