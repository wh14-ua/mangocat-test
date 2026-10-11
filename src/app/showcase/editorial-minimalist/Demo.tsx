"use client";

import Image from "next/image";
import Link from "next/link";
import { Spectral, Archivo } from "next/font/google";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { meridia, showcaseImages } from "@/config";
import { cn } from "@/lib/cn";

const spectral = Spectral({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-spectral",
  display: "swap",
});
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-archivo",
  display: "swap",
});

const img = showcaseImages["editorial-minimalist"];
const display = "font-[family-name:var(--font-spectral)]";
const eyebrow =
  "text-[0.7rem] font-medium uppercase tracking-[0.28em] text-[#17171A]/50";

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
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function EditorialMinimalistDemo() {
  const reduce = useReducedMotion();

  // Lead the opening sentence in full ink; let the rest settle back.
  const ledeParts = meridia.about.split(". ");
  const ledeLead = ledeParts[0] + (ledeParts.length > 1 ? ". " : "");
  const ledeRest = ledeParts.slice(1).join(". ");

  return (
    <div
      className={cn(
        spectral.variable,
        archivo.variable,
        "relative min-h-[100dvh] overflow-x-clip bg-[#FBFBF9] font-[family-name:var(--font-archivo)] text-[#17171A] antialiased selection:bg-[#17171A] selection:text-[#FBFBF9]",
      )}
    >
      {/* Header */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-6 py-6 sm:px-10 sm:py-7 lg:px-16">
          <Link
            href="/showcase"
            className="group inline-flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.22em] text-[#17171A]/70 transition-colors hover:text-[#17171A]"
          >
            <ArrowLeft aria-hidden
              weight="light"
              className="size-3.5 transition-transform group-hover:-translate-x-0.5"
            />
            Showcase
          </Link>
          <a
            href="#visit"
            className="border-b border-transparent pb-0.5 text-[0.72rem] uppercase tracking-[0.22em] text-[#17171A] transition-colors hover:border-[#D9442F]"
          >
            {meridia.ctaLabel}
          </a>
        </div>
      </header>

      {/* Hero, type first */}
      <section className="relative flex min-h-[100dvh] flex-col justify-center px-6 pt-28 pb-20 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-[1200px]">
          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              display,
              "text-[#17171A] text-[clamp(3.25rem,14vw,10rem)] font-normal leading-[0.95] tracking-[-0.01em]",
            )}
          >
            {meridia.name}
          </motion.h1>
          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8 h-px w-16 bg-[#D9442F]"
            aria-hidden="true"
          />
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8 max-w-[34ch] text-[clamp(1rem,2vw,1.35rem)] leading-relaxed text-[#17171A]/60"
          >
            {meridia.tagline}
          </motion.p>
          <motion.a
            href="#visit"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="group mt-12 inline-flex items-center gap-2 border-b border-[#D9442F] pb-1 text-[0.78rem] uppercase tracking-[0.18em] text-[#17171A]"
          >
            {meridia.ctaLabel}
            <ArrowRight aria-hidden
              weight="light"
              className="size-4 transition-transform group-hover:translate-x-1"
            />
          </motion.a>
        </div>
      </section>

      {/* Editorial lede */}
      <section className="px-6 py-24 sm:px-10 sm:py-32 lg:px-16 lg:py-40">
        <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 lg:grid-cols-12">
          <Reveal className="lg:col-span-10 lg:col-start-2">
            <p
              className={cn(
                display,
                "max-w-[60ch] text-[clamp(1.5rem,3.2vw,2.4rem)] font-light leading-[1.45] tracking-[-0.005em]",
              )}
            >
              <span className="text-[#17171A]">{ledeLead}</span>
              <span className="text-[#17171A]/55">{ledeRest}</span>
            </p>
          </Reveal>
        </div>
      </section>

      {/* Dishes as an editorial index */}
      <section className="px-6 pb-24 sm:px-10 sm:pb-32 lg:px-16 lg:pb-40">
        <div className="mx-auto w-full max-w-[1200px]">
          <Reveal>
            <p className={eyebrow}>The menu</p>
          </Reveal>
          <ul className="mt-10 sm:mt-14">
            {meridia.dishes.map((d, i) => (
              <Reveal key={d.name} delay={i * 0.05}>
                <li className="border-t border-[#17171A]/12 py-8 sm:py-10">
                  <div className="grid grid-cols-1 gap-y-2 md:grid-cols-12 md:items-baseline md:gap-6">
                    <span className="text-[0.8rem] tracking-[0.15em] text-[#17171A]/40 tabular-nums md:col-span-1">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3
                      className={cn(
                        display,
                        "text-[#17171A] text-[clamp(1.5rem,4vw,2.5rem)] font-normal leading-[1.1] tracking-[-0.01em] md:col-span-7",
                      )}
                    >
                      {d.name}
                    </h3>
                    <p className="text-[0.95rem] leading-relaxed text-[#17171A]/55 md:col-span-4 md:text-right">
                      {d.note}
                    </p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ul>
          <div className="border-t border-[#17171A]/12" aria-hidden="true" />
        </div>
      </section>

      {/* One large photographic moment */}
      <section className="py-12 sm:py-16">
        <Reveal>
          <figure>
            <div className="relative aspect-[4/3] w-full sm:aspect-[16/9] lg:aspect-[2/1]">
              <Image
                src={img.hero}
                alt="A plated course at MERIDIA on the Valencia waterfront"
                fill
                sizes="100vw"
                preload
                className="object-cover"
              />
            </div>
            <figcaption
              className={cn(
                display,
                "mx-auto mt-4 w-full max-w-[1200px] px-6 text-sm italic text-[#17171A]/55 sm:px-10 lg:px-16",
              )}
            >
              A midday table at MERIDIA, on the Valencia waterfront.
            </figcaption>
          </figure>
        </Reveal>
      </section>

      {/* Pull quote */}
      <section className="px-6 py-24 sm:px-10 sm:py-32 lg:px-16 lg:py-40">
        <div className="mx-auto w-full max-w-[1200px]">
          <Reveal>
            <blockquote className="max-w-[24ch]">
              <p
                className={cn(
                  display,
                  "pb-1 text-[clamp(1.75rem,5vw,3.5rem)] font-light italic leading-[1.1] tracking-[-0.01em] text-[#17171A]",
                )}
              >
                &ldquo;{meridia.quote.text}&rdquo;
              </p>
              <footer className="mt-10 flex items-center gap-4">
                <span className="h-px w-10 bg-[#D9442F]" aria-hidden="true" />
                <span className="text-[0.75rem] uppercase tracking-[0.2em] text-[#17171A]/60">
                  {meridia.quote.author}, {meridia.chef.role}
                </span>
              </footer>
            </blockquote>
          </Reveal>
        </div>
      </section>

      {/* Visit */}
      <section
        id="visit"
        className="scroll-mt-24 border-t border-[#17171A]/12 px-6 py-24 sm:px-10 sm:py-32 lg:px-16 lg:py-40"
      >
        <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-12 md:grid-cols-12 md:gap-10 lg:gap-16">
          <Reveal className="md:col-span-5">
            <div className="relative aspect-[4/5] w-full">
              <Image
                src={img.dish}
                alt="A plated course at MERIDIA"
                fill
                sizes="(max-width: 768px) 100vw, 40vw"
                className="object-cover"
              />
            </div>
          </Reveal>
          <Reveal delay={0.1} className="md:col-span-6 md:col-start-7">
            <p className={eyebrow}>Visit</p>
            <dl className="mt-8 border-t border-[#17171A]/12">
              {meridia.hours.map((h) => (
                <div
                  key={h.days}
                  className="flex flex-col gap-1 border-b border-[#17171A]/12 py-4 md:flex-row md:items-baseline md:justify-between md:gap-6"
                >
                  <dt className="font-medium tracking-[0.01em] text-[#17171A]">
                    {h.days}
                  </dt>
                  <dd className="text-[0.95rem] text-[#17171A]/55 md:text-right">
                    {h.detail}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2">
              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.22em] text-[#17171A]/40">
                  Address
                </p>
                <p className="mt-3 text-[0.95rem] leading-relaxed text-[#17171A]/70">
                  {meridia.address.street}
                  <br />
                  {meridia.address.city}
                </p>
              </div>
              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.22em] text-[#17171A]/40">
                  Reservations
                </p>
                <div className="mt-3 flex flex-col gap-1.5 text-[0.95rem] text-[#17171A]/70">
                  <a
                    href={meridia.contact.phoneHref}
                    className="w-fit transition-colors hover:text-[#17171A]"
                  >
                    {meridia.contact.phone}
                  </a>
                  <a
                    href={`mailto:${meridia.contact.email}`}
                    className="w-fit transition-colors hover:text-[#17171A]"
                  >
                    {meridia.contact.email}
                  </a>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#17171A]/12 px-6 py-14 sm:px-10 sm:py-16 lg:px-16">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <span className={cn(display, "text-2xl tracking-[0.02em] sm:text-3xl")}>
            {meridia.name}
          </span>
          <div className="flex flex-col gap-2 text-[0.8rem] text-[#17171A]/55 md:items-end">
            <a
              href={meridia.social.href}
              target="_blank"
              rel="noreferrer"
              className="w-fit transition-colors hover:text-[#17171A]"
            >
              {meridia.social.label}
            </a>
            <span>Fictional demo · MangoCat Studios</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
