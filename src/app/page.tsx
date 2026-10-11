import { Hero } from "@/components/sections/home/Hero";
import { IntroStatement } from "@/components/sections/home/IntroStatement";
import { Experiences } from "@/components/sections/home/Experiences";
import { ChefFeature } from "@/components/sections/ChefFeature";
import { FeaturedDishes } from "@/components/sections/home/FeaturedDishes";
import { ReservationBand } from "@/components/sections/ReservationBand";

export default function HomePage() {
  return (
    <>
      <Hero />
      <IntroStatement />
      <Experiences />
      <ChefFeature />
      <FeaturedDishes />
      <ReservationBand />
    </>
  );
}
