"use client";

import { useEffect } from "react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In a real deployment this would report to an error service.
    console.error(error);
  }, [error]);

  return (
    <section className="flex min-h-[72dvh] items-center pt-24">
      <Container>
        <Eyebrow>Something went wrong</Eyebrow>
        <h1 className="mt-5 max-w-3xl font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.05] text-porcelain">
          A course did not land
        </h1>
        <p className="mt-5 max-w-md font-sans text-lg leading-relaxed text-mist">
          An unexpected error interrupted the page. You can try again, or head
          back to the home page.
        </p>
        <div className="mt-9 flex flex-col gap-4 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center justify-center bg-ember px-6 font-sans text-[0.8125rem] font-semibold uppercase tracking-[0.16em] text-on-ember transition-colors duration-300 hover:bg-ember-deep touch-manip"
          >
            Try Again
          </button>
          <Button href="/" variant="secondary">
            Back to Home
          </Button>
        </div>
      </Container>
    </section>
  );
}
