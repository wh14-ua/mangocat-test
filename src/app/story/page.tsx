import type { Metadata } from "next";
import { StoryOpener } from "@/components/sections/story/StoryOpener";
import { Philosophy } from "@/components/sections/story/Philosophy";
import { ChefFeature } from "@/components/sections/ChefFeature";
import { Values } from "@/components/sections/story/Values";
import { PullQuote } from "@/components/sections/story/PullQuote";
import { Provenance } from "@/components/sections/story/Provenance";
import { ReservationBand } from "@/components/sections/ReservationBand";

export const metadata: Metadata = {
  title: "Our Story",
  description:
    "The idea behind ATELIER: one small room in Lyon, a menu written each morning from the market, and a kitchen that answers to the season.",
  alternates: { canonical: "/story" },
};

export default function StoryPage() {
  return (
    <>
      <StoryOpener />
      <Philosophy />
      <ChefFeature />
      <Values />
      <PullQuote />
      <Provenance />
      <ReservationBand
        headingLines={["Join us for an evening"]}
        body="One seating a night, the full room eating together. We would be glad to have you at the table."
      />
    </>
  );
}
