import { menu, reserveCta } from "@/config";
import { formatPrice } from "@/lib/format";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/motion/Reveal";

export function TastingFeature() {
  const t = menu.tasting;
  return (
    <section className="py-16 lg:py-24">
      <Container>
        <Reveal>
          <div className="border border-line bg-coal p-8 md:p-12 lg:p-16">
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-7">
                <h2 className="font-display text-[clamp(2rem,4vw,3rem)] leading-tight text-porcelain">
                  {t.name}
                </h2>
                <p className="mt-5 max-w-xl font-sans text-base leading-relaxed text-mist">
                  {t.description}
                </p>
                <ul className="mt-8 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                  {t.highlights.map((h) => (
                    <li
                      key={h}
                      className="border-l border-line pl-4 font-sans text-sm leading-relaxed text-mist"
                    >
                      {h}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col justify-between gap-10 lg:col-span-5 lg:border-l lg:border-line lg:pl-16">
                <div>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-sans text-xs uppercase tracking-[0.14em] text-ash">
                      {t.courses} courses
                    </span>
                    <span className="nums font-display text-4xl text-porcelain">
                      {formatPrice(t.price)}
                    </span>
                  </div>
                  <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-line pt-4">
                    <span className="font-sans text-xs uppercase tracking-[0.14em] text-ash">
                      {t.pairingName}
                    </span>
                    <span className="nums font-display text-3xl text-ember">
                      {formatPrice(t.pairingPrice)}
                    </span>
                  </div>
                </div>
                <Button href={reserveCta.href}>{reserveCta.label}</Button>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
