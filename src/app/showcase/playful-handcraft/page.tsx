import type { Metadata } from "next";
import { PlayfulHandcraftDemo } from "./Demo";

export const metadata: Metadata = {
  title: { absolute: "Playful Handcraft · MERIDIA · MangoCat Showcase" },
  description:
    "Design Showcase demo by MangoCat Studios. A warm, hand-crafted, highly interactive direction for a seasonal harbour restaurant.",
  robots: { index: false, follow: true },
};

export default function Page() {
  return <PlayfulHandcraftDemo />;
}
