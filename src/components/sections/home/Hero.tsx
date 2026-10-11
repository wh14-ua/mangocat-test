import { ParallaxImage } from "@/components/motion/ParallaxImage";
import { TextReveal } from "@/components/motion/TextReveal";
import { Reveal } from "@/components/motion/Reveal";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { site, reserveCta, images } from "@/config";

export function Hero() {
  return (
    <section className="relative min-h-[100dvh] w-full">
      <ParallaxImage
        src={images.heroDining}
        alt="A candlelit table in the ATELIER dining room at night"
        priority
        sizes="100vw"
        scrim="full"
        strength={12}
      />

      <Container className="relative z-10 flex min-h-[100dvh] flex-col justify-end pb-20 pt-28 lg:pb-28">
        <div className="max-w-4xl">
          <Reveal>
            <Eyebrow className="mb-6">Contemporary Gastronomy</Eyebrow>
          </Reveal>

          <TextReveal
            as="h1"
            lines={["Dinner, written", "each morning."]}
            className="font-display font-normal text-porcelain text-[clamp(3rem,9vw,7.5rem)] leading-[0.95] tracking-[-0.015em]"
          />

          <Reveal delay={0.25}>
            <p className="mt-7 max-w-xl text-pretty font-sans text-lg leading-relaxed text-porcelain/85 md:text-xl">
              A 24-seat room on the Quai Saint-Antoine. One seating, one menu,
              drawn from the morning market.
            </p>
          </Reveal>

          <Reveal delay={0.38}>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Button href={reserveCta.href} size="lg">
                {reserveCta.label}
              </Button>
              <Button href="/menu" variant="secondary" size="lg">
                View the Menu
              </Button>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
