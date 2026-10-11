import type { Metadata } from "next";
import { MapPin, Phone, EnvelopeSimple, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { site, reserveCta, images } from "@/config";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { RevealImage } from "@/components/motion/RevealImage";
import { Reveal } from "@/components/motion/Reveal";
import { SocialLinks } from "@/components/layout/SocialLinks";

export const metadata: Metadata = {
  title: "Contact",
  description: `Find ATELIER at ${site.address.line1}, ${site.address.postalCode} ${site.address.city}. Opening hours, phone, email and directions.`,
  alternates: { canonical: "/contact" },
};

const blockLabel = "font-sans text-xs font-medium uppercase tracking-[0.14em] text-ash";

export default function ContactPage() {
  return (
    <section className="pb-28 pt-32 lg:pb-40 lg:pt-44">
      <Container>
        <SectionHeading
          as="h1"
          eyebrow="Contact"
          titleLines={["Find us on", "the Quai"]}
          size="xl"
          lead={`On the right bank of the Saône in the heart of Lyon, a few minutes' walk from Place des Jacobins.`}
          className="max-w-4xl"
        />
      </Container>

      <Container wide className="mt-14 lg:mt-20">
        <RevealImage
          src={images.contactInterior}
          alt="The entrance to ATELIER on the Quai Saint-Antoine in the evening"
          aspect="wide"
          sizes="100vw"
          scrim="soft"
          priority
        />
      </Container>

      <Container className="mt-16 lg:mt-24">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-16">
          {/* Details */}
          <div className="lg:col-span-5">
            <div className="space-y-10">
              <div>
                <h2 className={blockLabel}>
                  <MapPin weight="light" className="mr-2 inline size-4 text-ember" aria-hidden="true" />
                  Address
                </h2>
                <address className="mt-3 not-italic font-sans text-base leading-relaxed text-porcelain">
                  {site.address.line1}
                  <br />
                  {site.address.postalCode} {site.address.city}, {site.address.country}
                </address>
                <a
                  href={site.address.directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group mt-4 inline-flex items-center gap-1.5 font-sans text-sm text-ember underline-offset-4 hover:underline"
                >
                  Get directions
                  <ArrowUpRight
                    weight="light"
                    className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </a>
              </div>

              <div>
                <h2 className={blockLabel}>Hours</h2>
                <dl className="mt-3 space-y-2 font-sans text-sm">
                  {site.openingHours.map((h, i) => (
                    <div key={i} className="flex justify-between gap-6 border-b border-line pb-2">
                      <dt className="text-porcelain">{h.days}</dt>
                      <dd className="nums text-right text-mist">
                        {h.service === "Closed" ? "Closed" : `${h.service} · ${h.time}`}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div>
                <h2 className={blockLabel}>Get in touch</h2>
                <ul className="mt-3 space-y-2 font-sans text-base">
                  <li>
                    <a
                      href={site.contact.phoneHref}
                      className="group inline-flex items-center gap-2 text-porcelain hover:text-ember"
                    >
                      <Phone weight="light" className="size-4 text-ember" aria-hidden="true" />
                      <span className="nums">{site.contact.phoneDisplay}</span>
                    </a>
                  </li>
                  <li>
                    <a
                      href={`mailto:${site.contact.email}`}
                      className="group inline-flex items-center gap-2 text-porcelain hover:text-ember"
                    >
                      <EnvelopeSimple weight="light" className="size-4 text-ember" aria-hidden="true" />
                      {site.contact.email}
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h2 className={blockLabel}>Follow</h2>
                <SocialLinks className="mt-4" />
              </div>

              <div className="pt-2">
                <Button href={reserveCta.href}>{reserveCta.label}</Button>
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="lg:col-span-7">
            <Reveal>
              <div className="relative aspect-[4/3] overflow-hidden border border-line bg-coal lg:aspect-[16/12]">
                <iframe
                  title={`Map showing ATELIER at ${site.address.line1}, ${site.address.city}`}
                  src={site.address.mapEmbedSrc}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="absolute inset-0 h-full w-full"
                  style={{
                    filter:
                      "invert(0.92) hue-rotate(180deg) brightness(0.9) contrast(0.95) grayscale(0.3)",
                  }}
                />
              </div>
              <p className="mt-3 font-sans text-xs text-ash">
                Map data &copy; OpenStreetMap contributors.
              </p>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}
