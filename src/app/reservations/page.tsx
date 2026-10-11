import type { Metadata } from "next";
import { Info } from "@phosphor-icons/react/dist/ssr";
import { site, images } from "@/config";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { RevealImage } from "@/components/motion/RevealImage";
import { Reveal } from "@/components/motion/Reveal";
import { ReservationForm } from "@/components/sections/reservations/ReservationForm";

export const metadata: Metadata = {
  title: "Reservations",
  description:
    "Request a table at ATELIER. A demonstration booking flow: choose a date, service, time and party size. To book for real, call or email us.",
  alternates: { canonical: "/reservations" },
};

export default function ReservationsPage() {
  return (
    <section className="pb-28 pt-32 lg:pb-40 lg:pt-44">
      <Container>
        <SectionHeading
          as="h1"
          eyebrow="Reservations"
          titleLines={["Reserve a table"]}
          size="xl"
          lead={site.reservations.policy}
          className="max-w-4xl"
        />

        <Reveal delay={0.15}>
          <p className="mt-8 flex max-w-2xl items-start gap-3 border border-line bg-coal p-4 font-sans text-sm leading-relaxed text-mist">
            <Info
              weight="light"
              className="mt-0.5 size-5 shrink-0 text-ember"
              aria-hidden="true"
            />
            <span>
              This is a portfolio demonstration. The form below simulates a
              reservation and does not contact the restaurant. For a real
              booking, call or email us.
            </span>
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-12 lg:mt-20 lg:grid-cols-12 lg:gap-16">
          {/* Info aside */}
          <aside className="order-2 lg:order-1 lg:col-span-5">
            <RevealImage
              src={images.reservationBand}
              alt="An intimate table set for the evening service at ATELIER"
              aspect="landscape"
              sizes="(max-width: 1024px) 100vw, 40vw"
              priority
            />

            <div className="mt-8 space-y-8">
              <div>
                <h2 className="font-sans text-xs font-medium uppercase tracking-[0.14em] text-ash">
                  Good to know
                </h2>
                <p className="mt-3 font-sans text-sm leading-relaxed text-mist">
                  {site.reservations.leadNote}
                </p>
              </div>

              <div>
                <h2 className="font-sans text-xs font-medium uppercase tracking-[0.14em] text-ash">
                  Hours
                </h2>
                <dl className="mt-3 space-y-2 font-sans text-sm text-mist">
                  {site.openingHours.map((h, i) => (
                    <div key={i} className="flex justify-between gap-4">
                      <dt className="text-porcelain">{h.days}</dt>
                      <dd className="nums text-right">
                        {h.service === "Closed" ? "Closed" : h.time}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div>
                <h2 className="font-sans text-xs font-medium uppercase tracking-[0.14em] text-ash">
                  Prefer to call?
                </h2>
                <p className="mt-3 font-sans text-sm text-mist">
                  <a
                    href={site.reservations.phoneHref}
                    className="nums text-porcelain underline-offset-4 hover:text-ember hover:underline"
                  >
                    {site.reservations.phoneDisplay}
                  </a>
                  <br />
                  <a
                    href={`mailto:${site.reservations.email}`}
                    className="text-porcelain underline-offset-4 hover:text-ember hover:underline"
                  >
                    {site.reservations.email}
                  </a>
                </p>
              </div>
            </div>
          </aside>

          {/* Form */}
          <div className="order-1 lg:order-2 lg:col-span-7">
            <ReservationForm />
          </div>
        </div>
      </Container>
    </section>
  );
}
