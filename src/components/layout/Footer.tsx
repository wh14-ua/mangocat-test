import Link from "next/link";
import { site, reserveCta } from "@/config";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { SocialLinks } from "./SocialLinks";
import { Reveal } from "@/components/motion/Reveal";

const linkClass =
  "link-underline inline-block text-mist transition-colors duration-300 hover:text-porcelain focus-visible:text-porcelain";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative border-t border-line bg-coal">
      <Container className="py-20 lg:py-28">
        <div className="grid grid-cols-1 gap-y-14 lg:grid-cols-12 lg:gap-x-10">
          {/* Brand + CTA */}
          <div className="lg:col-span-5">
            <Reveal>
              <Link
                href="/"
                className="font-display text-4xl tracking-[0.12em] text-porcelain transition-colors duration-300 hover:text-ember"
              >
                {site.wordmark}
              </Link>
              <p className="mt-5 max-w-sm text-balance font-sans text-base leading-relaxed text-mist">
                {site.shortDescription}
              </p>
              <div className="mt-8">
                <Button href={reserveCta.href} variant="secondary">
                  {reserveCta.label}
                </Button>
              </div>
            </Reveal>
          </div>

          {/* Columns */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-3 lg:col-span-7">
            {/* Visit */}
            <div>
              <h2 className="eyebrow mb-5 text-ash">Visit</h2>
              <address className="not-italic font-sans text-sm leading-relaxed text-mist">
                {site.address.line1}
                <br />
                {site.address.postalCode} {site.address.city}
                <br />
                {site.address.country}
              </address>
              <a
                href={site.address.directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${linkClass} mt-4`}
              >
                Get directions
              </a>
            </div>

            {/* Hours */}
            <div>
              <h2 className="eyebrow mb-5 text-ash">Hours</h2>
              <dl className="space-y-3 font-sans text-sm text-mist">
                {site.openingHours.map((h, i) => (
                  <div key={i}>
                    <dt className="text-porcelain">{h.days}</dt>
                    <dd className="text-mist">
                      {h.service === "Closed" ? "Closed" : `${h.service}, ${h.time}`}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Explore + Contact */}
            <div className="col-span-2 sm:col-span-1">
              <h2 className="eyebrow mb-5 text-ash">Explore</h2>
              <ul className="space-y-3 font-sans text-sm">
                {site.nav.map((n) => (
                  <li key={n.href}>
                    <Link href={n.href} className={linkClass}>
                      {n.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href={reserveCta.href} className={linkClass}>
                    Reservations
                  </Link>
                </li>
              </ul>

              <h2 className="eyebrow mb-5 mt-10 text-ash">Contact</h2>
              <ul className="space-y-3 font-sans text-sm">
                <li>
                  <a href={site.contact.phoneHref} className={`${linkClass} nums`}>
                    {site.contact.phoneDisplay}
                  </a>
                </li>
                <li>
                  <a href={`mailto:${site.contact.email}`} className={linkClass}>
                    {site.contact.email}
                  </a>
                </li>
              </ul>
              <SocialLinks className="mt-6" />
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-20 flex flex-col gap-y-3 border-t border-line pt-8 text-xs text-ash sm:flex-row sm:items-center sm:justify-between">
          <p className="nums">
            &copy; {year} {site.legalName}. {site.address.city}, {site.address.country}.
          </p>
          <p className="tracking-[0.1em]">{site.tagline}</p>
        </div>
      </Container>
    </footer>
  );
}
