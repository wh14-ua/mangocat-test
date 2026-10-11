import { story } from "@/config";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { RevealImage } from "@/components/motion/RevealImage";
import { Reveal } from "@/components/motion/Reveal";

const alts = [
  "Seasonal produce carried in from the morning market",
  "The chef's counter looking into the kitchen",
  "A cook finishing a plate at the pass",
];

export function Provenance() {
  const [a, b, c] = story.provenance.images;
  return (
    <section className="py-24 lg:py-36">
      <Container>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <SectionHeading titleLines={["Where it", "comes from"]} size="md" />
            <Reveal delay={0.15}>
              <p className="mt-6 max-w-sm font-sans text-base leading-relaxed text-mist">
                {story.provenance.body}
              </p>
            </Reveal>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:col-span-8 lg:gap-6">
            <div className="col-span-2">
              <RevealImage src={a} alt={alts[0]} aspect="wide" sizes="(max-width: 1024px) 100vw, 66vw" />
            </div>
            <RevealImage src={b} alt={alts[1]} aspect="square" sizes="(max-width: 1024px) 50vw, 33vw" />
            <RevealImage src={c} alt={alts[2]} aspect="square" sizes="(max-width: 1024px) 50vw, 33vw" />
          </div>
        </div>
      </Container>
    </section>
  );
}
