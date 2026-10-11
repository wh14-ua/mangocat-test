import type { Metadata } from "next";
import { NaturalOrganicDemo } from "./Demo";

export const metadata: Metadata = {
  title: { absolute: "Natural Organic · MERIDIA · MangoCat Showcase" },
  description:
    "Design Showcase demo by MangoCat Studios. An earthy, artisanal farm-to-table direction for a seasonal restaurant.",
  robots: { index: false, follow: true },
};

export default function Page() {
  return <NaturalOrganicDemo />;
}
