import { story, site } from "@/config";
import { Container } from "@/components/ui/Container";
import { RevealImage } from "@/components/motion/RevealImage";
import { TextReveal } from "@/components/motion/TextReveal";
import { Reveal } from "@/components/motion/Reveal";

export function ChefFeature() {
  return (
    <section className="border-t border-line py-24 lg:py-36">
      <Container>
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <RevealImage
              src={story.chef.portrait}
              alt={`${story.chef.name}, ${story.chef.role} at ${site.name}`}
              aspect="portrait"
              sizes="(max-width: 1024px) 100vw, 40vw"
            />
          </div>

          <div className="lg:col-span-6 lg:col-start-7">
            <TextReveal
              as="blockquote"
              lines={[
                "“A plate should taste of a",
                "place and a week, and of",
                "almost nothing else.”",
              ]}
              lineClassName="pb-[0.14em]"
              className="font-display text-[clamp(1.9rem,3.4vw,2.9rem)] font-light italic leading-[1.25] text-porcelain"
            />

            <div className="mt-8 space-y-4">
              {story.chef.bio.map((p, i) => (
                <Reveal key={i} delay={0.15 + i * 0.08}>
                  <p className="max-w-xl font-sans text-base leading-relaxed text-mist">
                    {p}
                  </p>
                </Reveal>
              ))}
            </div>

            <Reveal delay={0.35}>
              <p className="mt-8 font-sans text-sm tracking-[0.04em] text-ash">
                {story.chef.name}, {story.chef.role}
              </p>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}
