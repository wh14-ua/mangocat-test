import { menu } from "@/config";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";

export function MenuHeader() {
  return (
    <section className="pt-32 lg:pt-44">
      <Container>
        <SectionHeading
          as="h1"
          eyebrow="The Menu"
          titleLines={["Written this week"]}
          size="xl"
          lead={menu.intro}
          className="max-w-4xl"
        />

        <Reveal delay={0.2}>
          <ul className="mt-12 flex flex-wrap gap-x-7 gap-y-3 border-t border-line pt-6 font-sans text-xs text-ash">
            {menu.legend.map((l) => (
              <li key={l.code}>
                <span className="font-semibold uppercase tracking-[0.12em] text-ember/80">
                  {l.code}
                </span>
                <span className="ml-1.5">{l.label}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </section>
  );
}
