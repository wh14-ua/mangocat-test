"use client";

import Image from "next/image";
import Link from "next/link";
import { Manrope, JetBrains_Mono } from "next/font/google";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { showcaseDesigns, meridia, type ShowcaseDesign } from "@/config";
import { cn } from "@/lib/cn";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jbmono",
  display: "swap",
});

const monoFont = "font-[family-name:var(--font-jbmono)]";

const ACCENT = "#E8812B"; // MangoCat accent, used sparingly

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
      initial={reduce ? false : { opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Swatches({ design }: { design: ShowcaseDesign }) {
  const colors = [design.background, design.accent, design.foreground];
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {colors.map((c) => (
        <span
          key={c}
          className="size-4 rounded-full ring-1 ring-black/10"
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

function DesignCard({
  design,
  index,
  featured = false,
}: {
  design: ShowcaseDesign;
  index: number;
  featured?: boolean;
}) {
  const { variance, motion: m, density } = design.dials;
  return (
    <Link
      href={`/showcase/${design.slug}`}
      className="group flex flex-col border border-[#16161A]/12 bg-white transition-colors duration-300 hover:border-[#16161A]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8812B]"
    >
      {/* Desktop preview with a mobile inset */}
      <div className={cn("relative w-full overflow-hidden bg-[#ECEAE6]", featured ? "aspect-[16/9]" : "aspect-[16/10]")}>
        <Image
          src={design.previewDesktop}
          alt={`Vista previa de escritorio del diseño ${design.name} para MERIDIA`}
          fill
          sizes={featured ? "100vw" : "(max-width: 1024px) 100vw, 50vw"}
          className="object-cover object-top transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
        />
        <div className="absolute bottom-3 right-3 w-[16%] min-w-[58px] max-w-[112px] overflow-hidden rounded-[3px] border-2 border-white bg-[#ECEAE6] shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
          <div className="relative aspect-[9/19]">
            <Image
              src={design.previewMobile}
              alt={`Vista previa móvil del diseño ${design.name}`}
              fill
              sizes="112px"
              className="object-cover object-top"
            />
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-1 flex-col gap-5 p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className={cn(monoFont, "text-xs text-[#16161A]/45")}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className={cn("mt-1 font-semibold tracking-tight text-[#16161A]", featured ? "text-3xl sm:text-4xl" : "text-2xl")}>
              {design.name}
            </h3>
            <p className="mt-1 text-sm text-[#16161A]/55">{design.tagline}</p>
          </div>
          <Swatches design={design} />
        </div>

        <p className={cn("max-w-xl text-[15px] leading-relaxed text-[#16161A]/70", featured && "sm:text-base")}>
          {design.description}
        </p>

        <div className={cn(monoFont, "flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] uppercase tracking-wider text-[#16161A]/50")}>
          <span>{design.type}</span>
          <span className="text-[#16161A]/25">/</span>
          <span>Var {variance}</span>
          <span>Mot {m}</span>
          <span>Den {density}</span>
        </div>

        <span className="mt-auto inline-flex items-center gap-2 pt-2 text-sm font-semibold text-[#16161A]">
          <span className="relative">
            Ver demo
            <span className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-[#E8812B] transition-transform duration-300 group-hover:scale-x-100" />
          </span>
          <ArrowUpRight aria-hidden
            weight="bold"
            className="size-4 text-[#E8812B] transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </span>
      </div>
    </Link>
  );
}

export function CatalogView() {
  const [featured, ...rest] = showcaseDesigns;

  return (
    <div
      className={cn(
        manrope.variable,
        mono.variable,
        "min-h-[100dvh] bg-[#F6F5F3] font-[family-name:var(--font-manrope)] text-[#16161A] antialiased",
      )}
    >
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#16161A]/10 bg-[#F6F5F3]/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1340px] items-center justify-between px-5 py-4 sm:px-8">
          <span className="text-[15px] font-extrabold tracking-tight">
            MangoCat<span className="text-[#E8812B]">.</span>Studios
          </span>
          <div className={cn(monoFont, "flex items-center gap-5 text-[11px] uppercase tracking-[0.15em] text-[#16161A]/55")}>
            <span className="hidden sm:inline">Design Showcase</span>
            <a href="mailto:hola@mangocat.studio" className="transition-colors hover:text-[#16161A]">
              Contacto
            </a>
          </div>
        </div>
      </header>

      {/* Intro */}
      <section className="mx-auto max-w-[1340px] px-5 pb-16 pt-20 sm:px-8 sm:pb-24 sm:pt-28">
        <Reveal>
          <p className={cn(monoFont, "text-xs uppercase tracking-[0.22em] text-[#E8812B]")}>
            Catálogo de diseño
          </p>
          <h1 className="mt-6 max-w-4xl text-balance text-[#16161A] text-[clamp(2.4rem,6vw,4.75rem)] font-extrabold leading-[1.02] tracking-tight">
            Seis direcciones para una misma carta.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-[#16161A]/65">
            Tomamos un restaurante ficticio, {meridia.name}, y lo diseñamos de seis maneras
            distintas. El mismo contenido, seis identidades completas. Elige el lenguaje que
            encaja con tu marca y lo desarrollamos a medida.
          </p>
        </Reveal>
      </section>

      {/* Featured + grid */}
      <section className="mx-auto max-w-[1340px] px-5 pb-24 sm:px-8 sm:pb-36">
        <Reveal>
          <DesignCard design={featured} index={0} featured />
        </Reveal>
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          {rest.map((d, i) => (
            <Reveal key={d.slug} delay={(i % 2) * 0.08}>
              <DesignCard design={d} index={i + 1} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#16161A]/10">
        <div className="mx-auto flex max-w-[1340px] flex-col gap-8 px-5 py-16 sm:flex-row sm:items-end sm:justify-between sm:px-8">
          <div>
            <span className="text-2xl font-extrabold tracking-tight">
              MangoCat<span className="text-[#E8812B]">.</span>Studios
            </span>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-[#16161A]/55">
              Estudio de diseño y desarrollo web. Las seis propuestas usan un restaurante
              ficticio (MERIDIA) y fotografía con licencia, a modo de demostración.
            </p>
          </div>
          <div className={cn(monoFont, "flex flex-col gap-2 text-[13px] text-[#16161A]/60 sm:text-right")}>
            <a href="mailto:hola@mangocat.studio" className="transition-colors hover:text-[#16161A]">
              hola@mangocat.studio
            </a>
            <Link href="/" className="transition-colors hover:text-[#16161A]">
              Proyecto en vivo: ATELIER
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
