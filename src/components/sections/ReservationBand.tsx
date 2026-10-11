import { ParallaxImage } from "@/components/motion/ParallaxImage";
import { TextReveal } from "@/components/motion/TextReveal";
import { Reveal } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { reserveCta, images } from "@/config";

/** Full-bleed reservation call-to-action band. Reused on Home and Our Story. */
export function ReservationBand({
  headingLines = ["A table for the evening"],
  body = "24 seats, a single seating each night. Reservations open 60 days ahead.",
}: {
  headingLines?: string[];
  body?: string;
}) {
  return (
    <section className="relative isolate w-full overflow-hidden">
      <ParallaxImage
        src={images.reservationBand}
        alt="An intimate table set for the evening service"
        sizes="100vw"
        scrim="full"
        strength={10}
      />
      <Container className="relative z-10 flex min-h-[72vh] flex-col items-center justify-center py-28 text-center lg:min-h-[80vh]">
        <TextReveal
          as="h2"
          lines={headingLines}
          className="font-display font-normal text-porcelain text-[clamp(2.5rem,6vw,5rem)] leading-[1.0]"
        />
        <Reveal delay={0.15}>
          <p className="mt-6 max-w-xl text-pretty font-sans text-lg leading-relaxed text-porcelain/85">
            {body}
          </p>
        </Reveal>
        <Reveal delay={0.25}>
          <div className="mt-10">
            <Button href={reserveCta.href} size="lg">
              {reserveCta.label}
            </Button>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
