import { story } from "@/config";
import { Container } from "@/components/ui/Container";
import { TextReveal } from "@/components/motion/TextReveal";
import { Reveal } from "@/components/motion/Reveal";

export function PullQuote() {
  return (
    <section className="border-y border-line bg-coal">
      <Container className="py-28 lg:py-40">
        <figure className="mx-auto max-w-4xl text-center">
          <TextReveal
            as="blockquote"
            lines={[
              "“We are not trying to be remembered",
              "for one dish. We are trying to cook",
              "this week, properly.”",
            ]}
            lineClassName="pb-[0.14em]"
            className="font-display text-[clamp(1.9rem,4.4vw,3.4rem)] font-light italic leading-[1.22] text-porcelain"
          />
          <Reveal delay={0.2}>
            <figcaption className="mt-9 font-sans text-sm tracking-[0.06em] text-ash">
              {story.pullQuote.attribution}
            </figcaption>
          </Reveal>
        </figure>
      </Container>
    </section>
  );
}
