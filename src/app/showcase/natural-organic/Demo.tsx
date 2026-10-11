"use client";

import Image from "next/image";
import Link from "next/link";
import { Newsreader, Mulish } from "next/font/google";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Phone,
  EnvelopeSimple,
  MapPin,
  InstagramLogo,
} from "@phosphor-icons/react/dist/ssr";
import { meridia, showcaseImages } from "@/config";
import { cn } from "@/lib/cn";

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});
const mulish = Mulish({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mulish",
  display: "swap",
});

const img = showcaseImages["natural-organic"];
const display = "font-[family-name:var(--font-newsreader)]";
// One soft radius language, held across every corner on the page.
const radius = "rounded-[10px]";

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function NaturalOrganicDemo() {
  const reduce = useReducedMotion();

  // Ethos prose: a Newsreader lead sentence, then a calm Mulish body.
  const [aboutLead, ...aboutRest] = meridia.about.split(". ");
  const aboutBody = aboutRest.join(". ");
  // Tagline with one italic emphasis word.
  const taglineParts = meridia.tagline.split(/(seasonal)/i);

  return (
    <div
      className={cn(
        newsreader.variable,
        mulish.variable,
        "min-h-[100dvh] bg-[#EFEBDE] font-[family-name:var(--font-mulish)] text-[#2B2E26] antialiased selection:bg-[#6E7A4E] selection:text-[#EFEBDE]",
      )}
    >
      {/* Header */}
      <header className="border-b border-[#2B2E26]/15">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-5 sm:px-10">
          <Link
            href="/showcase"
            className="group inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#6E7A4E] transition-colors hover:text-[#55613B]"
          >
            <ArrowLeft aria-hidden weight="light" className="size-4 transition-transform group-hover:-translate-x-0.5" />
            Showcase
          </Link>
          <a
            href="#visit"
            className={cn(
              radius,
              "inline-flex items-center border border-[#6E7A4E] px-5 py-2 text-[11px] uppercase tracking-[0.18em] text-[#6E7A4E] transition-colors hover:bg-[#6E7A4E] hover:text-[#EFEBDE]",
            )}
          >
            {meridia.ctaLabel}
          </a>
        </div>
      </header>

      {/* Hero: oat canvas, soft Newsreader headline, one calm image, airy */}
      <section className="relative">
        <div className="mx-auto grid min-h-[100dvh] max-w-[1500px] grid-cols-1 gap-10 px-5 py-16 sm:px-10 lg:grid-cols-2 lg:gap-16 lg:py-0">
          <div className="flex flex-col justify-center lg:py-24">
            <motion.p
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="mb-6 text-[11px] uppercase tracking-[0.26em] text-[#6E7A4E]"
            >
              Km 0 kitchen · Valencia
            </motion.p>
            <motion.h1
              initial={reduce ? false : { opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className={cn(display, "text-[#2B2E26] text-[clamp(3rem,10vw,7rem)] font-normal leading-[0.95] tracking-[0.01em]")}
            >
              {meridia.name}
            </motion.h1>
            <motion.p
              initial={reduce ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                display,
                "mt-6 max-w-md pb-1 text-[clamp(1.25rem,3vw,1.9rem)] font-light leading-[1.1] text-[#2B2E26]/85",
              )}
            >
              {taglineParts.map((part, i) =>
                part.toLowerCase() === "seasonal" ? (
                  <em key={i} className="italic text-[#55613B]">
                    {part}
                  </em>
                ) : (
                  <span key={i}>{part}</span>
                ),
              )}
            </motion.p>
            <motion.a
              href="#visit"
              initial={reduce ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                radius,
                "mt-10 inline-flex w-fit items-center gap-2.5 bg-[#6E7A4E] px-7 py-3.5 text-[12px] uppercase tracking-[0.18em] text-[#EFEBDE] transition-colors hover:bg-[#55613B]",
              )}
            >
              {meridia.ctaLabel}
              <ArrowRight aria-hidden weight="bold" className="size-4" />
            </motion.a>
          </div>

          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
            className={cn(radius, "group relative min-h-[46vh] overflow-hidden lg:my-10 lg:min-h-0")}
          >
            <Image
              src={img.hero}
              alt="A calm, sunlit corner of the MERIDIA dining room"
              fill
              preload
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover motion-safe:transition-transform motion-safe:duration-[1200ms] motion-safe:ease-out motion-safe:group-hover:scale-[1.04]"
            />
          </motion.div>
        </div>
      </section>

      {/* Ethos: a calm prose block, Newsreader lead over Mulish body */}
      <section className="border-t border-[#2B2E26]/15">
        <div className="mx-auto max-w-[62ch] px-5 py-24 sm:px-10 sm:py-32">
          <Reveal>
            <div className="h-px w-14 bg-[#6E7A4E]" />
            <p className={cn(display, "mt-8 text-[clamp(1.4rem,2.6vw,1.95rem)] font-light leading-[1.5] text-[#2B2E26]")}>
              {aboutLead}.
            </p>
            <p className="mt-6 text-[16px] leading-[1.75] text-[#2B2E26]/75">{aboutBody}</p>
          </Reveal>
        </div>
      </section>

      {/* Dishes: an earthy ledger beside one produce image */}
      <section className="border-t border-[#2B2E26]/15">
        <div className="mx-auto grid max-w-[1500px] grid-cols-1 items-center gap-10 px-5 py-24 sm:px-10 sm:py-28 lg:grid-cols-2 lg:gap-16">
          <div>
            <Reveal>
              <h2 className={cn(display, "pb-1 text-[#2B2E26] text-[clamp(2rem,4vw,3rem)] font-normal leading-[1.1] tracking-[0.01em]")}>
                From the market
              </h2>
              <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-[#2B2E26]/70">
                A single menu, written each afternoon around the morning catch and whatever the garden gives.
              </p>
            </Reveal>
            <ul className="mt-10">
              {meridia.dishes.map((d, i) => (
                <Reveal key={d.name} delay={i * 0.05}>
                  <li className="flex items-baseline gap-5 border-t border-[#2B2E26]/15 py-5">
                    <span className={cn(display, "text-sm text-[#6E7A4E]")}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className={cn(display, "text-xl font-normal tracking-[0.01em] text-[#2B2E26]")}>
                        {d.name}
                      </p>
                      <p className="mt-1 text-[15px] italic text-[#2B2E26]/65">{d.note}</p>
                    </div>
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>

          <Reveal
            delay={0.1}
            className={cn(radius, "group relative min-h-[52vh] overflow-hidden lg:min-h-[70vh]")}
          >
            <Image
              src={img.dish}
              alt="A seasonal plate at MERIDIA"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover motion-safe:transition-transform motion-safe:duration-[1200ms] motion-safe:ease-out motion-safe:group-hover:scale-[1.04]"
            />
          </Reveal>
        </div>
      </section>

      {/* Full-bleed image with the chef quote over a soft bark scrim */}
      <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden">
        <Image
          src={img.room}
          alt="The MERIDIA dining room by the waterfront"
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#2B2E26]/85 via-[#2B2E26]/60 to-[#2B2E26]/45" />
        <Reveal className="relative mx-auto max-w-3xl px-6 text-center">
          <p className={cn(display, "text-[clamp(1.5rem,3.4vw,2.6rem)] font-light italic leading-[1.4] text-[#EFEBDE]")}>
            <span className="text-[#EFEBDE]/70">&ldquo;</span>
            {meridia.quote.text}
            <span className="text-[#EFEBDE]/70">&rdquo;</span>
          </p>
          <div className="mx-auto mt-8 h-px w-12 bg-[#6E7A4E]" />
          <p className="mt-6 text-[11px] uppercase tracking-[0.26em] text-[#EFEBDE]/85">
            {meridia.quote.author}, {meridia.chef.role}
          </p>
        </Reveal>
      </section>

      {/* Visit */}
      <section id="visit" className="scroll-mt-24 border-t border-[#2B2E26]/15 bg-[#E6E0CF]">
        <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-12 px-5 py-24 sm:px-10 lg:grid-cols-12 lg:gap-16 lg:py-28">
          <div className="lg:col-span-5">
            <Reveal>
              <h2 className={cn(display, "pb-1 text-[#2B2E26] text-[clamp(2.2rem,4.5vw,3.4rem)] font-normal leading-[1.1] tracking-[0.01em]")}>
                Visit MERIDIA
              </h2>
              <p className="mt-6 max-w-sm text-[16px] leading-relaxed text-[#2B2E26]/75">
                Tables open on the first of each month. Call or write and we will hold a place for you.
              </p>
              <div className="mt-8 flex flex-col gap-3 text-[15px]">
                <a
                  href={meridia.contact.phoneHref}
                  className="inline-flex w-fit items-center gap-3 text-[#2B2E26] transition-colors hover:text-[#55613B]"
                >
                  <Phone aria-hidden weight="light" className="size-4 text-[#6E7A4E]" />
                  {meridia.contact.phone}
                </a>
                <a
                  href={`mailto:${meridia.contact.email}`}
                  className="inline-flex w-fit items-center gap-3 text-[#2B2E26] transition-colors hover:text-[#55613B]"
                >
                  <EnvelopeSimple aria-hidden weight="light" className="size-4 text-[#6E7A4E]" />
                  {meridia.contact.email}
                </a>
              </div>
            </Reveal>
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <Reveal delay={0.1}>
              <dl className="divide-y divide-[#2B2E26]/15 border-y border-[#2B2E26]/15">
                {meridia.hours.map((h) => (
                  <div key={h.days} className="flex items-baseline justify-between gap-6 py-4">
                    <dt className={cn(display, "text-[15px] tracking-[0.01em] text-[#2B2E26]")}>{h.days}</dt>
                    <dd className="text-right text-[15px] text-[#2B2E26]/70">{h.detail}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-8 flex items-start gap-3 text-[15px] leading-relaxed text-[#2B2E26]/75">
                <MapPin aria-hidden weight="light" className="mt-0.5 size-4 shrink-0 text-[#6E7A4E]" />
                <span>
                  {meridia.address.street}
                  <br />
                  {meridia.address.city}
                </span>
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#2B2E26]/15">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-5 py-12 sm:px-10 md:flex-row md:items-center md:justify-between">
          <span className={cn(display, "text-2xl tracking-[0.1em] text-[#2B2E26]")}>{meridia.name}</span>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] uppercase tracking-[0.18em] text-[#2B2E26]/60">
            <a
              href={meridia.social.href}
              className="inline-flex items-center gap-2 transition-colors hover:text-[#55613B]"
            >
              <InstagramLogo aria-hidden weight="light" className="size-4 text-[#6E7A4E]" />
              {meridia.social.label}
            </a>
            <span>Km 0 · Valencia</span>
            <span>Fictional demo · MangoCat Studios</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
