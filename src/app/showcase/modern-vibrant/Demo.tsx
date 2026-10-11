"use client";

import Image from "next/image";
import Link from "next/link";
import { Bricolage_Grotesque, Space_Grotesk } from "next/font/google";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowUpRight,
  Clock,
  EnvelopeSimple,
  InstagramLogo,
  MapPin,
  Phone,
} from "@phosphor-icons/react/dist/ssr";
import { meridia, showcaseImages } from "@/config";
import { cn } from "@/lib/cn";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-bricolage",
  display: "swap",
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const img = showcaseImages["modern-vibrant"];
const display = "font-[family-name:var(--font-bricolage)]";
const spring = { type: "spring", stiffness: 380, damping: 24 } as const;

// Marquee vocabulary. Separated on screen by a slash, never a dash.
const MARQUEE = ["SEASONAL", "FIRE", "MARKET", "TIDE", "EMBERS", "HARBOUR"];

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
      initial={reduce ? false : { opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Marquee() {
  const reduce = useReducedMotion();

  const strip = (hidden: boolean) => (
    <div className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {MARQUEE.map((word, i) => (
        <span key={word} className="flex items-center">
          <span
            className={cn(
              display,
              "px-6 text-[clamp(2.5rem,9vw,6.5rem)] font-extrabold tracking-[-0.02em] sm:px-10",
              i % 2 === 0 ? "text-[#FF5A2C]" : "text-[#F7F6F2]",
            )}
          >
            {word}
          </span>
          <span
            aria-hidden
            className={cn(display, "text-[clamp(2.5rem,9vw,6.5rem)] font-normal text-[#F7F6F2]/25")}
          >
            /
          </span>
        </span>
      ))}
    </div>
  );

  // Same DOM on server and client (two strips); only the animation is gated on
  // reduced-motion, so there is no hydration mismatch. Under reduced motion the
  // strip is simply static and clipped by the section's overflow-hidden.
  return (
    <section className="overflow-hidden bg-[#141414] py-7 sm:py-9">
      <motion.div
        className="flex w-max"
        animate={reduce ? undefined : { x: ["0%", "-50%"] }}
        transition={
          reduce ? undefined : { duration: 18, ease: "linear", repeat: Infinity }
        }
      >
        {strip(false)}
        {strip(true)}
      </motion.div>
    </section>
  );
}

export function ModernVibrantDemo() {
  const reduce = useReducedMotion();

  const liftProps = reduce
    ? {}
    : {
        whileHover: { scale: 1.03, y: -6, transition: spring },
        whileTap: { scale: 0.97, transition: spring },
      };

  return (
    <div
      className={cn(
        bricolage.variable,
        spaceGrotesk.variable,
        "min-h-[100dvh] overflow-x-clip bg-[#F7F6F2] font-[family-name:var(--font-space-grotesk)] text-[#141414] antialiased selection:bg-[#FF5A2C] selection:text-[#141414]",
      )}
    >
      {/* Header, one line */}
      <header className="relative z-40">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link
            href="/showcase"
            className="group inline-flex items-center gap-2 text-[13px] font-medium text-[#141414] transition-colors hover:text-[#FF5A2C]"
          >
            <ArrowLeft aria-hidden weight="bold" className="size-4 transition-transform group-hover:-translate-x-1" />
            Showcase
          </Link>
          <motion.a
            href="#visit"
            {...liftProps}
            className="inline-flex items-center gap-2 rounded-full bg-[#FF5A2C] px-5 py-2.5 text-[13px] font-bold whitespace-nowrap text-[#141414]"
          >
            {meridia.ctaLabel}
            <ArrowUpRight aria-hidden weight="bold" className="size-4" />
          </motion.a>
        </div>
      </header>

      {/* Hero, color-block + giant type, off-grid overlap */}
      <section className="relative flex min-h-[100dvh] flex-col justify-center overflow-hidden px-5 pb-16 pt-10 sm:px-8">
        <div className="relative z-10 mx-auto w-full max-w-[1400px]">
          <motion.span
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center rounded-full bg-[#FF5A2C] px-4 py-1.5 text-[12px] font-medium tracking-[0.02em] text-[#141414]"
          >
            Seasonal kitchen, Valencia
          </motion.span>
          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              display,
              "mt-6 text-[clamp(3.5rem,15vw,12rem)] font-extrabold leading-[0.82] tracking-[-0.04em] text-[#141414]",
            )}
          >
            {meridia.name}
          </motion.h1>

          <div className="mt-10 grid items-start gap-10 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-5 lg:pt-4">
              <motion.p
                initial={reduce ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-md text-[clamp(1.05rem,2.4vw,1.45rem)] font-medium leading-snug text-[#141414]/75"
              >
                {meridia.tagline}
              </motion.p>
              <motion.a
                href="#visit"
                {...liftProps}
                initial={reduce ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#FF5A2C] px-7 py-4 text-[15px] font-bold whitespace-nowrap text-[#141414]"
              >
                {meridia.ctaLabel}
                <ArrowUpRight aria-hidden weight="bold" className="size-4" />
              </motion.a>
            </div>

            <div className="relative lg:col-span-7">
              {/* Tangerine color block, peeking behind the image, off-grid */}
              <div
                aria-hidden
                className="absolute inset-0 hidden rounded-[28px] bg-[#FF5A2C] lg:block lg:translate-x-[8%] lg:translate-y-6"
              />
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 24, scale: 1.03 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 1.1, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="relative aspect-[16/11] w-full overflow-hidden rounded-[28px]"
              >
                <Image
                  src={img.hero}
                  alt="MERIDIA, a seasonal kitchen by the harbour"
                  fill
                  preload
                  sizes="(min-width: 1024px) 58vw, 100vw"
                  className="object-cover"
                />
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Kinetic marquee, the one marquee */}
      <Marquee />

      {/* Dishes, bold asymmetric grid */}
      <section className="bg-[#F7F6F2] px-5 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto max-w-[1400px]">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:gap-12">
            <Reveal>
              <h2
                className={cn(
                  display,
                  "text-[clamp(2.75rem,7vw,6rem)] font-extrabold leading-[0.86] tracking-[-0.03em] text-[#141414]",
                )}
              >
                Over the embers
              </h2>
              <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-[#141414]/70">
                One menu, written each afternoon around the market and the tide. Four of tonight&apos;s courses.
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[28px] lg:translate-y-6">
                <Image
                  src={img.detail}
                  alt="A close detail from a course at MERIDIA"
                  fill
                  sizes="(min-width: 1024px) 34vw, 100vw"
                  className="object-cover"
                />
              </div>
            </Reveal>
          </div>

          <ul className="mt-14 grid gap-4 sm:mt-20 lg:grid-cols-12 lg:gap-5">
            {meridia.dishes.map((d, i) => (
              <motion.li
                key={d.name}
                {...liftProps}
                initial={reduce ? false : { opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.6, delay: (i % 2) * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  i % 2 === 0 ? "lg:col-span-7" : "lg:col-span-5",
                  "flex items-start gap-5 rounded-[28px] bg-[#FFFFFF] p-7 sm:p-9",
                )}
              >
                <span
                  className={cn(
                    display,
                    "text-[clamp(1.5rem,3vw,2.25rem)] font-bold leading-none text-[#FF5A2C]",
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p
                    className={cn(
                      display,
                      "text-[clamp(1.6rem,3.4vw,2.6rem)] font-bold leading-[0.95] tracking-[-0.02em] text-[#141414]",
                    )}
                  >
                    {d.name}
                  </p>
                  <p className="mt-2 text-[15px] text-[#141414]/60">{d.note}</p>
                </div>
              </motion.li>
            ))}
          </ul>

          <Reveal>
            <div className="relative mt-10 aspect-[16/10] w-full overflow-hidden rounded-[28px] sm:aspect-[16/7] lg:mt-14 lg:w-[92%] lg:translate-x-[8%]">
              <Image
                src={img.dish}
                alt="A plated course at MERIDIA"
                fill
                sizes="(min-width: 1024px) 92vw, 100vw"
                className="object-cover"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Statement, full tangerine color-block */}
      <section className="bg-[#FF5A2C] px-5 py-28 sm:px-8 sm:py-40">
        <div className="mx-auto max-w-[1400px]">
          <Reveal>
            <p
              className={cn(
                display,
                "max-w-[16ch] text-[clamp(2.4rem,6.5vw,5.5rem)] font-extrabold leading-[0.92] tracking-[-0.03em] text-[#141414]",
              )}
            >
              What the boats land, and what the garden gives.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-12 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <p className="text-[14px] font-medium uppercase tracking-[0.16em] text-[#141414]">
                {meridia.chef.name}, {meridia.chef.role}
              </p>
              <motion.a
                href="#visit"
                {...liftProps}
                className="inline-flex w-fit items-center gap-2 rounded-full bg-[#141414] px-7 py-3.5 text-[14px] font-bold whitespace-nowrap text-[#F7F6F2]"
              >
                {meridia.ctaLabel}
                <ArrowUpRight aria-hidden weight="bold" className="size-4" />
              </motion.a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Visit */}
      <section
        id="visit"
        className="scroll-mt-24 bg-[#141414] px-5 py-24 text-[#F7F6F2] sm:px-8 sm:py-32"
      >
        <div className="mx-auto grid max-w-[1400px] gap-14 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <Reveal>
              <h2
                className={cn(
                  display,
                  "text-[clamp(3rem,8vw,6.5rem)] font-extrabold leading-[0.85] tracking-[-0.03em]",
                )}
              >
                Find the <span className="text-[#FF5A2C]">table</span>
              </h2>
              <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-[#F7F6F2]/70">
                Twenty-eight seats on the Valencia waterfront. Call or write and we will hold a place.
              </p>
              <div className="mt-10 space-y-5">
                <div className="flex items-start gap-3">
                  <MapPin aria-hidden weight="bold" className="mt-1 size-5 shrink-0 text-[#FF5A2C]" />
                  <p className="text-[17px] font-medium">
                    {meridia.address.street}
                    <br />
                    {meridia.address.city}
                  </p>
                </div>
                <a
                  href={meridia.contact.phoneHref}
                  className="group flex items-center gap-3 transition-colors"
                >
                  <Phone aria-hidden weight="bold" className="size-5 shrink-0 text-[#FF5A2C]" />
                  <span className="text-[17px] font-medium transition-colors group-hover:text-[#FF5A2C]">
                    {meridia.contact.phone}
                  </span>
                </a>
                <a
                  href={`mailto:${meridia.contact.email}`}
                  className="group flex items-center gap-3 transition-colors"
                >
                  <EnvelopeSimple aria-hidden weight="bold" className="size-5 shrink-0 text-[#FF5A2C]" />
                  <span className="text-[17px] font-medium transition-colors group-hover:text-[#FF5A2C]">
                    {meridia.contact.email}
                  </span>
                </a>
              </div>
            </Reveal>
          </div>
          <div className="lg:col-span-5 lg:col-start-8">
            <Reveal delay={0.1}>
              <div className="flex items-center gap-2">
                <Clock aria-hidden weight="bold" className="size-5 text-[#FF5A2C]" />
                <span className="text-[13px] font-bold uppercase tracking-[0.18em] text-[#F7F6F2]/70">
                  Hours
                </span>
              </div>
              <dl className="mt-6 divide-y divide-[#F7F6F2]/15 border-y border-[#F7F6F2]/15">
                {meridia.hours.map((h) => (
                  <div key={h.days} className="flex items-baseline justify-between gap-6 py-5">
                    <dt className="text-[17px] font-bold">{h.days}</dt>
                    <dd className="text-right text-[15px] text-[#F7F6F2]/70">{h.detail}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#141414] px-5 pb-14 pt-10 text-[#F7F6F2] sm:px-8">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-8 border-t border-[#F7F6F2]/15 pt-10 md:flex-row md:items-end md:justify-between">
          <span
            className={cn(
              display,
              "text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-none tracking-[-0.03em]",
            )}
          >
            {meridia.name}
          </span>
          <div className="flex flex-col gap-3 text-[13px] md:items-end">
            <a
              href={meridia.social.href}
              className="group inline-flex items-center gap-2 font-medium transition-colors hover:text-[#FF5A2C]"
            >
              <InstagramLogo aria-hidden weight="bold" className="size-4" />
              {meridia.social.label}
            </a>
            <span className="text-[#F7F6F2]/50">Fictional demo · MangoCat Studios</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
