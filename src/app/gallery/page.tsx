import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GalleryGrid } from "@/components/sections/gallery/GalleryGrid";

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "A photographic look inside ATELIER: the dishes, the dining room, the kitchen and the small details of an evening in Lyon.",
  alternates: { canonical: "/gallery" },
};

export default function GalleryPage() {
  return (
    <>
      <section className="pt-32 lg:pt-44">
        <Container>
          <SectionHeading
            as="h1"
            eyebrow="Gallery"
            titleLines={["Scenes from", "the room"]}
            size="xl"
            lead="A year of evenings, photographed as they happened: the plates, the pass, the room as it fills."
            className="max-w-4xl"
          />
        </Container>
        <div className="mt-16 lg:mt-20">
          <GalleryGrid />
        </div>
      </section>
    </>
  );
}
