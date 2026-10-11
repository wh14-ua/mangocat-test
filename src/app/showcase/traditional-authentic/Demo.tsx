"use client";

import Image from "next/image";
import Link from "next/link";
import { Bitter, Work_Sans } from "next/font/google";
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

const bitter = Bitter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-bitter",
  display: "swap",
});
const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-work-sans",
  display: "swap",
});

const img = showcaseImages["traditional-authentic"];
const display = "font-[family-name:var(--font-bitter)]";

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
      initial={reduce ? false : { opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function TraditionalAuthenticDemo() {
  return (
    <div
      className={cn(
        bitter.variable,
        workSans.variable,
        "min-h-[100dvh] bg-[#F4EADB] font-[family-name:var(--font-work-sans)] text-[#2E2A25] antialiased selection:bg-[#B23A2E] selection:text-[#F4EADB]",
      )}
    >
      {/* Header */}
      <header className="border-b border-[#2E2A25]/15 bg-[#F4EADB]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link
            href="/showcase"
            className="group inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.18em] text-[#2E2A25]/70 transition-colors hover:text-[#B23A2E]"
          >
            <ArrowLeft aria-hidden
              weight="bold"
              className="size-4 transition-transform group-hover:-translate-x-0.5"
            />
            Showcase
          </Link>
          <a
            href="#visit"
            className="inline-flex items-center gap-2 rounded-[2px] bg-[#B23A2E] px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#F4EADB] transition-colors hover:bg-[#9A3026]"
          >
            {meridia.ctaLabel}
          </a>
        </div>
      </header>

      {/* Hero: warm image with an overlapping offset ivory card */}
      <section className="relative flex min-h-[90dvh] flex-col">
        <div className="relative min-h-[52vh] w-full flex-1 overflow-hidden">
          <Image
            src={img.hero}
            alt="The MERIDIA dining room looking out over the Valencia harbour"
            fill
            preload
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#2E2A25]/45 via-[#2E2A25]/10 to-transparent" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-[1200px] px-5 pb-16 sm:px-8 sm:pb-20">
          <Reveal className="-mt-28 sm:-mt-36 lg:-mt-44">
            <div className="max-w-xl rounded-[2px] border border-[#2E2A25]/15 bg-[#F4EADB] p-7 shadow-[0_26px_60px_-28px_#2E2A2580] sm:p-10 lg:p-12">
              <h1
                className={cn(
                  display,
                  "text-[clamp(2.5rem,8.5vw,5.25rem)] font-bold leading-[0.95] tracking-[0.01em] text-[#2E2A25]",
                )}
              >
                {meridia.name}
              </h1>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-[#2E2A25]/75 sm:text-xl">
                {meridia.tagline}
              </p>
              <a
                href="#visit"
                className="mt-8 inline-flex items-center gap-2.5 rounded-[2px] bg-[#B23A2E] px-7 py-3.5 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#F4EADB] transition-colors hover:bg-[#9A3026]"
              >
                {meridia.ctaLabel}
                <ArrowUpRight aria-hidden weight="bold" className="size-4" />
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Story: Since 2016 */}
      <section className="border-t border-[#2E2A25]/15">
        <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 sm:py-28">
          <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-14">
            <Reveal className="order-2 md:order-1">
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[2px] border border-[#2E2A25]/15">
                <Image
                  src={img.room}
                  alt="The MERIDIA dining room set for dinner service"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover transition-transform duration-700 ease-out hover:scale-[1.04] motion-reduce:transition-none motion-reduce:hover:scale-100"
                />
              </div>
            </Reveal>
            <Reveal delay={0.1} className="order-1 md:order-2">
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-[#5A6B3B]" />
                <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#5A6B3B]">
                  Since {meridia.foundedYear}
                </p>
              </div>
              <h2
                className={cn(
                  display,
                  "mt-5 text-[clamp(2rem,4.5vw,3.25rem)] font-semibold leading-[1.1] text-[#2E2A25]",
                )}
              >
                A harbour kitchen, run like a home
              </h2>
              <p className="mt-6 text-base leading-relaxed text-[#2E2A25]/75">
                {meridia.about}
              </p>
              <p className="mt-4 text-base leading-relaxed text-[#2E2A25]/75">
                {meridia.chef.name} has cooked here from the very first service, and still
                runs the dining room as chef and owner.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Dishes as warm cards */}
      <section className="border-t border-[#2E2A25]/15 bg-[#F4EADB]">
        <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 sm:py-28">
          <Reveal>
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#B23A2E]">
              Tonight&rsquo;s table
            </p>
            <h2
              className={cn(
                display,
                "mt-3 text-[clamp(2rem,4.5vw,3rem)] font-semibold leading-tight text-[#2E2A25]",
              )}
            >
              Cooked over embers
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[#2E2A25]/70">
              One menu, written each afternoon around the market and the tide. Four plates
              from tonight&rsquo;s service.
            </p>
          </Reveal>

          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
            {/* Feature photo card */}
            <Reveal className="md:col-span-2">
              <article className="group grid grid-cols-1 overflow-hidden rounded-[2px] border border-[#2E2A25]/15 bg-[#EFE2CF] md:grid-cols-2">
                <div className="relative aspect-[4/3] w-full overflow-hidden md:aspect-auto md:min-h-[300px]">
                  <Image
                    src={img.dish}
                    alt={`${meridia.dishes[0].name}, a plated course at MERIDIA`}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                </div>
                <div className="flex flex-col justify-center gap-3 p-8 sm:p-10">
                  <span
                    className={cn(
                      display,
                      "text-sm font-semibold uppercase tracking-[0.18em] text-[#B23A2E]",
                    )}
                  >
                    01
                  </span>
                  <h3
                    className={cn(
                      display,
                      "text-2xl font-semibold leading-tight text-[#2E2A25] sm:text-[1.75rem]",
                    )}
                  >
                    {meridia.dishes[0].name}
                  </h3>
                  <p className="text-[15px] leading-relaxed text-[#2E2A25]/70">
                    {meridia.dishes[0].note}
                  </p>
                  <p className="text-[15px] leading-relaxed text-[#2E2A25]/55">
                    Landed this morning, finished over the fire at the pass.
                  </p>
                </div>
              </article>
            </Reveal>

            {/* Numeral cards */}
            {meridia.dishes.slice(1, 3).map((d, i) => (
              <Reveal key={d.name} delay={i * 0.05}>
                <article className="group flex h-full flex-col justify-between gap-10 rounded-[2px] border border-[#2E2A25]/15 bg-[#EFE2CF] p-8 transition-colors duration-300 hover:border-[#B23A2E]/45 motion-reduce:transition-none">
                  <span
                    className={cn(
                      display,
                      "text-5xl font-bold leading-none text-[#B23A2E] sm:text-6xl",
                    )}
                  >
                    {String(i + 2).padStart(2, "0")}
                  </span>
                  <div>
                    <h3
                      className={cn(
                        display,
                        "text-xl font-semibold text-[#2E2A25]",
                      )}
                    >
                      {d.name}
                    </h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-[#2E2A25]/65">
                      {d.note}
                    </p>
                  </div>
                </article>
              </Reveal>
            ))}

            {/* Wide numeral card */}
            <Reveal className="md:col-span-2">
              <article className="group flex h-full flex-col justify-between gap-8 rounded-[2px] border border-[#2E2A25]/15 bg-[#EFE2CF] p-8 transition-colors duration-300 hover:border-[#B23A2E]/45 motion-reduce:transition-none md:flex-row md:items-end md:gap-10 md:p-10">
                <span
                  className={cn(
                    display,
                    "text-5xl font-bold leading-none text-[#B23A2E] sm:text-7xl",
                  )}
                >
                  04
                </span>
                <div className="md:text-right">
                  <h3
                    className={cn(
                      display,
                      "text-xl font-semibold text-[#2E2A25] sm:text-2xl",
                    )}
                  >
                    {meridia.dishes[3].name}
                  </h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-[#2E2A25]/65">
                    {meridia.dishes[3].note}
                  </p>
                </div>
              </article>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Full-width market band with the chef quote */}
      <section className="relative overflow-hidden">
        <div className="relative flex min-h-[60vh] w-full items-center">
          <Image
            src={img.detail}
            alt="Produce from the morning market in Valencia"
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[#2E2A25]/72" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#B23A2E]/35 via-[#2E2A25]/20 to-[#2E2A25]/35" />
          <div className="relative mx-auto w-full max-w-[1000px] px-5 py-24 sm:px-8">
            <Reveal>
              <span className="block h-px w-12 bg-[#F4EADB]/60" />
              <blockquote
                className={cn(
                  display,
                  "mt-7 text-[clamp(1.6rem,3.6vw,2.6rem)] font-medium leading-[1.3] text-[#F4EADB]",
                )}
              >
                &ldquo;{meridia.quote.text}&rdquo;
              </blockquote>
              <p className="mt-6 text-[12px] font-semibold uppercase tracking-[0.2em] text-[#F4EADB]/80">
                {meridia.quote.author}, {meridia.chef.role}
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Visit */}
      <section
        id="visit"
        className="scroll-mt-24 border-t border-[#2E2A25]/15 bg-[#EFE2CF]"
      >
        <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 sm:py-28">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-10">
            <Reveal className="md:col-span-5">
              <h2
                className={cn(
                  display,
                  "text-[clamp(2rem,4.5vw,3rem)] font-semibold leading-tight text-[#2E2A25]",
                )}
              >
                Visit the dining room
              </h2>
              <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-[#2E2A25]/70">
                Tables open on the first of each month. Call or write and we will keep a
                place for you.
              </p>
              <div className="mt-8 flex flex-col gap-4 text-[15px]">
                <a
                  href={meridia.contact.phoneHref}
                  className="inline-flex items-center gap-3 font-medium text-[#B23A2E] transition-colors hover:text-[#9A3026]"
                >
                  <Phone aria-hidden weight="fill" className="size-4 shrink-0" />
                  {meridia.contact.phone}
                </a>
                <a
                  href={`mailto:${meridia.contact.email}`}
                  className="inline-flex items-center gap-3 font-medium text-[#B23A2E] transition-colors hover:text-[#9A3026]"
                >
                  <EnvelopeSimple aria-hidden weight="fill" className="size-4 shrink-0" />
                  {meridia.contact.email}
                </a>
                <p className="inline-flex items-start gap-3 text-[#2E2A25]/70">
                  <MapPin aria-hidden weight="fill" className="mt-0.5 size-4 shrink-0 text-[#B23A2E]" />
                  <span>
                    {meridia.address.street}, {meridia.address.city}
                  </span>
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.1} className="md:col-span-6 md:col-start-7">
              <div className="flex items-center gap-2.5">
                <Clock aria-hidden weight="fill" className="size-4 text-[#B23A2E]" />
                <h3
                  className={cn(display, "text-base font-semibold text-[#2E2A25]")}
                >
                  Hours
                </h3>
              </div>
              <dl className="mt-5 border-t border-[#2E2A25]/15">
                {meridia.hours.map((h) => (
                  <div
                    key={h.days}
                    className="flex items-baseline justify-between gap-6 border-b border-[#2E2A25]/15 py-4"
                  >
                    <dt
                      className={cn(
                        display,
                        "text-[15px] font-medium text-[#2E2A25]",
                      )}
                    >
                      {h.days}
                    </dt>
                    <dd className="text-right text-[15px] text-[#2E2A25]/70">
                      {h.detail}
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#2E2A25]/15 bg-[#F4EADB]">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 py-12 sm:px-8 md:flex-row md:items-center md:justify-between">
          <span
            className={cn(
              display,
              "text-2xl font-bold tracking-[0.08em] text-[#2E2A25]",
            )}
          >
            {meridia.name}
          </span>
          <div className="flex flex-col gap-3 text-[13px] text-[#2E2A25]/70 md:flex-row md:items-center md:gap-7">
            <a
              href={meridia.social.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 transition-colors hover:text-[#B23A2E]"
            >
              <InstagramLogo aria-hidden weight="fill" className="size-4" />
              {meridia.social.handle}
            </a>
            <span>
              Since {meridia.foundedYear} · Valencia
            </span>
            <span>Fictional demo · MangoCat Studios</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
