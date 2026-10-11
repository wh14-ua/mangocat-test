import { story } from "@/config";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { RevealImage } from "@/components/motion/RevealImage";

export function StoryOpener() {
  return (
    <section className="pt-32 lg:pt-44">
      <Container>
        <SectionHeading
          eyebrow={story.eyebrow}
          titleLines={["A workshop", "for the season"]}
          as="h1"
          size="xl"
          lead={story.lead}
          className="max-w-4xl"
        />
      </Container>
      <Container wide className="mt-16 lg:mt-24">
        <RevealImage
          src={story.opening.image}
          alt={story.opening.caption}
          aspect="wide"
          sizes="100vw"
          priority
          scrim="soft"
        />
      </Container>
    </section>
  );
}
