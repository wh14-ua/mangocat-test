import type { Metadata } from "next";
import { TraditionalAuthenticDemo } from "./Demo";

export const metadata: Metadata = {
  title: { absolute: "Traditional Authentic · MERIDIA · MangoCat Showcase" },
  description:
    "Design Showcase demo by MangoCat Studios. A warm, family-run heritage direction for a seasonal restaurant.",
  robots: { index: false, follow: true },
};

export default function Page() {
  return <TraditionalAuthenticDemo />;
}
