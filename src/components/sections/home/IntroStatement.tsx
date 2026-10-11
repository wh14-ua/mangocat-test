import { TextReveal } from "@/components/motion/TextReveal";
import { Reveal } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export function IntroStatement() {
  return (
    <section className="py-28 lg:py-40">
      <Container>
        <div className="max-w-[60rem]">
          <TextReveal
            as="p"
            lines={[
              "We keep one small room,",
              "cook what the market gives,",
              "and serve one menu to everyone in it.",
            ]}
            className="font-display font-light text-porcelain text-[clamp(1.9rem,4.6vw,3.6rem)] leading-[1.14]"
          />

          <Reveal delay={0.2}>
            <p className="mt-10 max-w-2xl font-sans text-lg leading-relaxed text-mist">
              No carte theatre, no signature dish repeated for a decade. The
              pleasure is in the particular: this turbot, this week, cooked once
              and cooked properly.
            </p>
          </Reveal>

          <Reveal delay={0.3}>
            <div className="mt-9">
              <Button href="/story" variant="ghost">
                Read Our Story
              </Button>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
