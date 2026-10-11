import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";

export default function NotFound() {
  return (
    <section className="flex min-h-[72dvh] items-center pt-24">
      <Container>
        <Eyebrow>Error 404</Eyebrow>
        <h1 className="mt-5 max-w-3xl font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.05] text-porcelain">
          Not on the menu
        </h1>
        <p className="mt-5 max-w-md font-sans text-lg leading-relaxed text-mist">
          The page you are looking for is not here. Let us take you back to the
          dining room.
        </p>
        <div className="mt-9 flex flex-col gap-4 sm:flex-row">
          <Button href="/">Back to Home</Button>
          <Button href="/menu" variant="secondary">
            View the Menu
          </Button>
        </div>
      </Container>
    </section>
  );
}
