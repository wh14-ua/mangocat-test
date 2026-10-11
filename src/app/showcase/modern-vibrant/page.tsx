import type { Metadata } from "next";
import { ModernVibrantDemo } from "./Demo";

export const metadata: Metadata = {
  title: { absolute: "Modern Vibrant · MERIDIA · MangoCat Showcase" },
  description:
    "Design Showcase demo by MangoCat Studios. A bold, contemporary, kinetic direction for a seasonal restaurant.",
  robots: { index: false, follow: true },
};

export default function Page() {
  return <ModernVibrantDemo />;
}
