import { story } from "@/config";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { RevealImage } from "@/components/motion/RevealImage";
import { Reveal } from "@/components/motion/Reveal";

export function Philosophy() {
  return (
    <section className="py-24 lg:py-36">
      <Container>
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-6">
            <SectionHeading titleLines={["Cooking is", "a daily study"]} size="lg" />
            <div className="mt-8 space-y-5">
              {story.philosophy.body.map((p, i) => (
                <Reveal key={i} delay={0.1 + i * 0.08}>
                  <p className="max-w-xl font-sans text-base leading-relaxed text-mist">
                    {p}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
          <div className="lg:col-span-6">
            <RevealImage
              src={story.philosophy.image}
              alt="The open kitchen at ATELIER during service"
              aspect="portrait"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
