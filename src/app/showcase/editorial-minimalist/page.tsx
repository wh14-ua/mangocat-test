import type { Metadata } from "next";
import { EditorialMinimalistDemo } from "./Demo";

export const metadata: Metadata = {
  title: { absolute: "Editorial Minimalist · MERIDIA · MangoCat Showcase" },
  description:
    "Design Showcase demo by MangoCat Studios. An editorial, minimalist direction for a seasonal restaurant.",
  robots: { index: false, follow: true },
};

export default function Page() {
  return <EditorialMinimalistDemo />;
}
