import Image from "next/image";
import { experiences } from "@/config";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";
import { cn } from "@/lib/cn";

/** Offset trio: three real photographs staggered on a descending diagonal. */
export function Experiences() {
  const offsets = ["md:mt-0", "md:mt-16", "md:mt-28"];

  return (
    <section className="border-t border-line py-24 lg:py-36">
      <Container>
        <SectionHeading
          eyebrow="The Evening"
          titleLines={["Three ways", "to spend it"]}
          size="lg"
          className="max-w-2xl"
        />

        <div className="mt-16 grid grid-cols-1 gap-x-8 gap-y-16 md:grid-cols-3 md:items-start lg:mt-24 lg:gap-x-10">
          {experiences.map((exp, i) => (
            <Reveal
              key={exp.title}
              as="figure"
              delay={i * 0.08}
              className={cn("group", offsets[i])}
            >
              <div className="relative aspect-[4/5] overflow-hidden bg-coal">
                <Image
                  src={exp.image}
                  alt={exp.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                />
                <div
                  className="pointer-events-none absolute inset-0 scrim-soft"
                  aria-hidden="true"
                />
              </div>
              <figcaption className="mt-6">
                <h3 className="font-display text-[1.6rem] leading-tight text-porcelain">
                  {exp.title}
                </h3>
                <p className="mt-3 max-w-xs font-sans text-sm leading-relaxed text-mist">
                  {exp.description}
                </p>
                <p className="mt-4 font-sans text-xs tracking-[0.08em] text-ash">
                  {exp.meta}
                </p>
              </figcaption>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
