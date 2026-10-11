import { story } from "@/config";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";

/** A hairline-divided index of the restaurant's values. Type-led, no cards. */
export function Values() {
  return (
    <section className="border-t border-line py-24 lg:py-36">
      <Container>
        <SectionHeading titleLines={["What we hold to"]} size="lg" className="max-w-2xl" />
        <div className="mt-14 grid grid-cols-1 gap-px border border-line bg-line md:grid-cols-2">
          {story.values.map((v, i) => (
            <Reveal key={v.title} delay={i * 0.06} className="bg-noir p-8 lg:p-12">
              <h3 className="font-display text-[1.65rem] leading-tight text-porcelain">
                {v.title}
              </h3>
              <p className="mt-4 max-w-md font-sans text-sm leading-relaxed text-mist">
                {v.body}
              </p>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
