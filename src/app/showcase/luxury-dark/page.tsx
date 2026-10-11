import type { Metadata } from "next";
import { LuxuryDarkDemo } from "./Demo";

export const metadata: Metadata = {
  title: { absolute: "Luxury Dark · MERIDIA · MangoCat Showcase" },
  description:
    "Design Showcase demo by MangoCat Studios. A cinematic, exclusive, nocturnal direction for a seasonal restaurant.",
  robots: { index: false, follow: true },
};

export default function Page() {
  return <LuxuryDarkDemo />;
}
