"use client";

import Image from "next/image";
import Link from "next/link";
import { Cinzel, Jost } from "next/font/google";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { meridia, showcaseImages } from "@/config";
import { cn } from "@/lib/cn";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-cinzel",
  display: "swap",
});
const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-jost",
  display: "swap",
});

const img = showcaseImages["luxury-dark"];
const display = "font-[family-name:var(--font-cinzel)]";

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
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function LuxuryDarkDemo() {
  const reduce = useReducedMotion();

  return (
    <div
      className={cn(
        cinzel.variable,
        jost.variable,
        "min-h-[100dvh] bg-[#0A0A0B] font-[family-name:var(--font-jost)] text-[#EDE9E1] antialiased selection:bg-[#C8A24A] selection:text-[#0A0A0B]",
      )}
    >
      {/* Header */}
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-6 sm:px-10">
          <Link
            href="/showcase"
            className="group inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#EDE9E1]/70 transition-colors hover:text-[#C8A24A]"
          >
            <ArrowLeft aria-hidden weight="light" className="size-4 transition-transform group-hover:-translate-x-1" />
            Showcase
          </Link>
          <a
            href="#visit"
            className="hidden border border-[#C8A24A]/50 px-6 py-2.5 text-[11px] uppercase tracking-[0.22em] text-[#C8A24A] transition-colors hover:bg-[#C8A24A] hover:text-[#0A0A0B] sm:inline-block"
          >
            {meridia.ctaLabel}
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex min-h-[100dvh] flex-col justify-end overflow-hidden">
        <motion.div
          className="absolute inset-0"
          animate={reduce ? undefined : { scale: [1, 1.09] }}
          transition={
            reduce
              ? undefined
              : { duration: 18, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }
          }
        >
          <Image
            src={img.hero}
            alt="A dark, candlelit dining room at MERIDIA"
            fill
            preload
            sizes="100vw"
            className="object-cover"
          />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0B] via-[#0A0A0B]/55 to-[#0A0A0B]/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0B]/70 to-transparent" />

        <div className="relative mx-auto w-full max-w-[1500px] px-5 pb-20 sm:px-10 sm:pb-28">
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="mb-5 text-[11px] uppercase tracking-[0.34em] text-[#C8A24A]"
          >
            Seasonal kitchen · Valencia
          </motion.p>
          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={cn(display, "text-[clamp(3.5rem,13vw,11rem)] font-medium leading-[0.9] tracking-[0.04em]")}
          >
            {meridia.name}
          </motion.h1>
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 max-w-md text-lg font-light leading-relaxed text-[#EDE9E1]/80"
          >
            {meridia.tagline}
          </motion.p>
          <motion.a
            href="#visit"
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="mt-10 inline-flex items-center gap-3 bg-[#C8A24A] px-8 py-4 text-[12px] uppercase tracking-[0.22em] text-[#0A0A0B] transition-colors hover:bg-[#E0BC63]"
          >
            {meridia.ctaLabel}
            <ArrowUpRight aria-hidden weight="bold" className="size-4" />
          </motion.a>
        </div>
      </section>

      {/* About, editorial statement */}
      <section className="mx-auto max-w-[1100px] px-5 py-28 sm:px-10 sm:py-40">
        <Reveal>
          <p className={cn(display, "text-[clamp(1.6rem,3.4vw,2.9rem)] font-normal leading-[1.4] tracking-[0.01em]")}>
            {meridia.about.split(". ").map((s, i, arr) => (
              <span key={i} className={i === 0 ? "text-[#EDE9E1]" : "text-[#EDE9E1]/55"}>
                {s}
                {i < arr.length - 1 ? ". " : ""}
              </span>
            ))}
          </p>
        </Reveal>
      </section>

      {/* Dishes, a quiet ledger beside one image */}
      <section className="border-t border-[#EDE9E1]/10">
        <div className="mx-auto grid max-w-[1500px] grid-cols-1 lg:grid-cols-2">
          <div className="relative min-h-[60vh] overflow-hidden lg:min-h-[80vh]">
            <Image
              src={img.dish}
              alt="A plated course at MERIDIA"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div className="flex flex-col justify-center px-5 py-20 sm:px-12 lg:px-16">
            <Reveal>
              <h2 className={cn(display, "text-[clamp(2rem,4vw,3.25rem)] font-normal leading-[1.05] tracking-[0.02em]")}>
                From the embers
              </h2>
              <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-[#EDE9E1]/55">
                A single menu, written each afternoon. Four of tonight's courses.
              </p>
            </Reveal>
            <ul className="mt-12">
              {meridia.dishes.map((d, i) => (
                <Reveal key={d.name} delay={i * 0.05}>
                  <li className="flex items-baseline gap-5 border-t border-[#EDE9E1]/10 py-6">
                    <span className={cn(display, "text-sm text-[#C8A24A]")}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className={cn(display, "text-xl font-normal tracking-[0.03em] text-[#EDE9E1]")}>
                        {d.name}
                      </p>
                      <p className="mt-1 text-[15px] italic text-[#EDE9E1]/55">{d.note}</p>
                    </div>
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Quote over image */}
      <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden">
        <Image
          src={img.room}
          alt="The dining room at MERIDIA"
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[#0A0A0B]/72" />
        <Reveal className="relative mx-auto max-w-3xl px-6 text-center">
          <p className="text-[clamp(1.5rem,3.4vw,2.6rem)] font-light leading-[1.45] text-[#EDE9E1]">
            <span className="text-[#C8A24A]">&ldquo;</span>
            {meridia.quote.text}
            <span className="text-[#C8A24A]">&rdquo;</span>
          </p>
          <p className="mt-8 text-[11px] uppercase tracking-[0.28em] text-[#C8A24A]">
            {meridia.quote.author}, {meridia.chef.role}
          </p>
        </Reveal>
      </section>

      {/* Visit */}
      <section id="visit" className="scroll-mt-24 border-t border-[#EDE9E1]/10 bg-[#0C0C0D]">
        <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-16 px-5 py-28 sm:px-10 lg:grid-cols-12 lg:py-36">
          <div className="lg:col-span-5">
            <Reveal>
              <h2 className={cn(display, "text-[clamp(2.2rem,4.5vw,3.5rem)] font-normal leading-[1.05] tracking-[0.02em]")}>
                Reserve the table
              </h2>
              <p className="mt-6 max-w-sm leading-relaxed text-[#EDE9E1]/60">
                Tables are released on the first of each month. To book, call or write and we will
                hold a place for you.
              </p>
              <div className="mt-10 flex flex-col gap-3 text-sm">
                <a href={meridia.contact.phoneHref} className="group inline-flex w-fit items-center gap-2 text-[#EDE9E1] transition-colors hover:text-[#C8A24A]">
                  {meridia.contact.phone}
                </a>
                <a href={`mailto:${meridia.contact.email}`} className="inline-flex w-fit items-center gap-2 text-[#EDE9E1] transition-colors hover:text-[#C8A24A]">
                  {meridia.contact.email}
                </a>
              </div>
            </Reveal>
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <Reveal delay={0.1}>
              <dl className="divide-y divide-[#EDE9E1]/10 border-y border-[#EDE9E1]/10">
                {meridia.hours.map((h) => (
                  <div key={h.days} className="flex items-baseline justify-between gap-6 py-5">
                    <dt className={cn(display, "text-sm tracking-[0.04em] text-[#EDE9E1]")}>{h.days}</dt>
                    <dd className="text-right text-[15px] text-[#EDE9E1]/55">{h.detail}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-8 text-[15px] leading-relaxed text-[#EDE9E1]/55">
                {meridia.address.street}
                <br />
                {meridia.address.city}
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#EDE9E1]/10 bg-[#0A0A0B]">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-5 py-14 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <span className={cn(display, "text-2xl tracking-[0.14em]")}>{meridia.name}</span>
          <div className="flex items-center gap-8 text-[11px] uppercase tracking-[0.2em] text-[#EDE9E1]/50">
            <a href={meridia.social.href} className="transition-colors hover:text-[#C8A24A]">
              {meridia.social.label}
            </a>
            <span>Fictional demo · MangoCat Studios</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
