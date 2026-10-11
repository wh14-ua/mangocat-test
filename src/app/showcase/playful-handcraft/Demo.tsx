"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { Anton, Hanken_Grotesk, Caveat } from "next/font/google";
import {
  motion,
  useReducedMotion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CaretDoubleDown,
  Clock,
  EnvelopeSimple,
  Fish,
  Flame,
  ForkKnife,
  InstagramLogo,
  MapPin,
  Phone,
  Quotes,
  Star,
} from "@phosphor-icons/react/dist/ssr";
import { meridia, playfulHandcraftImages as pics } from "@/config";
import { cn } from "@/lib/cn";

/* ───────────────────────── Fonts ─────────────────────────
 * A heavy condensed display (Anton), a friendly grotesque body (Hanken Grotesk),
 * and a marker hand (Caveat) for the doodle-style accent words. */
const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton", display: "swap" });
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-hanken",
  display: "swap",
});
const caveat = Caveat({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-caveat", display: "swap" });

const display = "font-[family-name:var(--font-anton)]";
const marker = "font-[family-name:var(--font-caveat)]";

/* ───────────────────────── Palette ─────────────────────────
 * Warm coastal, hand-crafted. Coral is the single action colour; ink text on coral
 * clears WCAG AA (4.6:1), and coralText is the darker coral used on light grounds. */
const INK = "#15171D";
const PAPER = "#FBF2E2";
const SAFFRON = "#F4A51C";
const CORAL = "#E64A2B";
const CORAL_TEXT = "#C43A1E";
const GREEN = "#2F6E57";
const CREAM = "#FFF9EF";

const inkTexture = {
  backgroundColor: INK,
  backgroundImage:
    "radial-gradient(120% 90% at 18% 0%, rgba(255,255,255,0.06), transparent 58%)," +
    "radial-gradient(90% 80% at 92% 100%, rgba(244,165,28,0.10), transparent 60%)," +
    "radial-gradient(70% 60% at 65% 30%, rgba(230,74,43,0.07), transparent 60%)",
} as const;

const saffronTexture = {
  backgroundColor: SAFFRON,
  backgroundImage:
    "radial-gradient(90% 70% at 85% 10%, rgba(255,255,255,0.28), transparent 55%)," +
    "radial-gradient(80% 80% at 10% 100%, rgba(230,74,43,0.12), transparent 60%)",
} as const;

const spring = { type: "spring", stiffness: 360, damping: 22 } as const;

/* ───────────────────────── Cursor parallax ─────────────────────────
 * One pointer listener at the root feeds spring motion values in the range -1..1.
 * `Drift` layers read them and translate by their own depth, so doodles and photos
 * drift with the cursor. Under reduced motion the values never move. */
type ParallaxValue = { x: MotionValue<number>; y: MotionValue<number> };
const ParallaxCtx = createContext<ParallaxValue | null>(null);

function ParallaxProvider({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 50, damping: 18, mass: 0.6 });
  const y = useSpring(my, { stiffness: 50, damping: 18, mass: 0.6 });
  useEffect(() => {
    if (reduce) return;
    const onMove = (e: PointerEvent) => {
      mx.set((e.clientX / window.innerWidth - 0.5) * 2);
      my.set((e.clientY / window.innerHeight - 0.5) * 2);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduce, mx, my]);
  return <ParallaxCtx.Provider value={{ x, y }}>{children}</ParallaxCtx.Provider>;
}

function Drift({
  dx = 18,
  dy = 18,
  className,
  children,
}: {
  dx?: number;
  dy?: number;
  className?: string;
  children: ReactNode;
}) {
  const ctx = useContext(ParallaxCtx);
  const zero = useMotionValue(0);
  const x = useTransform(ctx?.x ?? zero, (v) => v * dx);
  const y = useTransform(ctx?.y ?? zero, (v) => v * dy);
  return (
    <motion.div style={{ x, y }} className={className}>
      {children}
    </motion.div>
  );
}

/* ───────────────────────── Scroll reveal ───────────────────────── */
function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={reduce ? { duration: 0 } : { duration: 0.75, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ───────────────────────── Torn paper edge ─────────────────────────
 * A ragged horizontal edge, filled with the SECTION's own colour, pulled up so its
 * peaks rise into the previous section. Static by design (it bridges two grounds). */
const TORN =
  "M0 26 L46 14 L96 30 L158 10 L220 28 L286 9 L356 31 L418 14 L494 30 L560 11 " +
  "L636 30 L710 12 L790 31 L862 14 L942 30 L1016 10 L1096 30 L1168 12 L1248 30 " +
  "L1320 14 L1392 28 L1440 16 L1440 48 L0 48 Z";

function TornEdge({ color, className }: { color: string; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 48"
      preserveAspectRatio="none"
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 h-[clamp(20px,4vw,46px)] w-full -translate-y-[99%]",
        className,
      )}
    >
      <path d={TORN} fill={color} />
    </svg>
  );
}

/* ───────────────────────── Hand-drawn doodles (original) ─────────────────────────
 * Decorative only (aria-hidden). Stroke colour follows text colour. */
type DoodleProps = { className?: string };
const dAttr = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 3,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const Wave = ({ className }: DoodleProps) => (
  <svg aria-hidden viewBox="0 0 72 24" className={className}>
    <path d="M3 15 C 12 3, 21 3, 27 13 C 33 23, 42 23, 48 13 C 54 3, 63 3, 69 13" {...dAttr} />
  </svg>
);
const Spark = ({ className }: DoodleProps) => (
  <svg aria-hidden viewBox="0 0 40 40" className={className}>
    <path d="M20 2 C 22 15, 25 18, 38 20 C 25 22, 22 25, 20 38 C 18 25, 15 22, 2 20 C 15 18, 18 15, 20 2 Z" {...dAttr} />
  </svg>
);
const Flourish = ({ className }: DoodleProps) => (
  <svg aria-hidden viewBox="0 0 80 40" className={className}>
    <path d="M4 32 C 10 6, 22 6, 26 24 C 30 4, 44 4, 48 24 C 52 6, 64 6, 72 30" {...dAttr} />
  </svg>
);
const Fishy = ({ className }: DoodleProps) => (
  <svg aria-hidden viewBox="0 0 80 44" className={className}>
    <path d="M6 22 C 20 6, 50 6, 60 22 C 50 38, 20 38, 6 22 Z" {...dAttr} />
    <path d="M60 22 L76 12 L76 32 Z" {...dAttr} />
    <circle cx="22" cy="19" r="2.4" fill="currentColor" />
  </svg>
);
const Sprig = ({ className }: DoodleProps) => (
  <svg aria-hidden viewBox="0 0 48 72" className={className}>
    <path d="M24 70 C 24 48, 24 26, 26 4" {...dAttr} />
    <path d="M25 50 C 12 46, 8 36, 10 28 C 20 30, 26 40, 25 50 Z" {...dAttr} />
    <path d="M26 38 C 39 34, 43 24, 41 16 C 31 18, 25 28, 26 38 Z" {...dAttr} />
  </svg>
);
const Swoosh = ({ className }: DoodleProps) => (
  <svg aria-hidden viewBox="0 0 90 30" className={className}>
    <path d="M4 20 C 30 30, 60 30, 86 8" {...dAttr} />
    <path d="M86 8 L74 10 M86 8 L82 20" {...dAttr} />
  </svg>
);
const Dot = ({ className }: DoodleProps) => (
  <svg aria-hidden viewBox="0 0 16 16" className={className}>
    <circle cx="8" cy="8" r="6" fill="currentColor" />
  </svg>
);

/* A scatter of coloured confetti dots used in warm panels. */
function Confetti({ className }: DoodleProps) {
  const dots = [
    { x: "6%", y: "22%", c: CORAL, s: 10 },
    { x: "84%", y: "10%", c: INK, s: 9 },
    { x: "92%", y: "62%", c: CORAL, s: 12 },
    { x: "14%", y: "78%", c: GREEN, s: 10 },
    { x: "70%", y: "88%", c: INK, s: 8 },
  ];
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      {dots.map((d, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{ left: d.x, top: d.y, width: d.s, height: d.s, backgroundColor: d.c }}
        />
      ))}
    </div>
  );
}

/* ───────────────────────── Small UI atoms ───────────────────────── */
function StickerButton({
  href,
  children,
  variant = "coral",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "coral" | "ink" | "paper";
  className?: string;
}) {
  const reduce = useReducedMotion();
  const skin =
    variant === "coral"
      ? "bg-[#E64A2B] text-[#15171D] shadow-[5px_5px_0_#15171D]"
      : variant === "paper"
        ? "bg-[#FBF2E2] text-[#15171D] shadow-[5px_5px_0_#15171D]"
        : "bg-[#15171D] text-[#FBF2E2] shadow-[5px_5px_0_#E64A2B]";
  return (
    <motion.a
      href={href}
      whileHover={reduce ? undefined : { x: -2, y: -2 }}
      whileTap={reduce ? undefined : { x: 1, y: 1, transition: spring }}
      className={cn(
        display,
        "inline-flex items-center gap-2 border-2 border-[#15171D] px-7 py-3.5 text-[clamp(1rem,1.6vw,1.2rem)] uppercase tracking-[0.02em] whitespace-nowrap transition-colors",
        skin,
        className,
      )}
    >
      {children}
    </motion.a>
  );
}

function Eyebrow({
  children,
  on = "light",
  className,
}: {
  children: ReactNode;
  on?: "light" | "dark";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[0.22em]",
        className,
      )}
      style={{ color: on === "dark" ? CORAL : CORAL_TEXT }}
    >
      <Dot className="size-2.5" />
      {children}
    </span>
  );
}

/* ───────────────────────── Content ───────────────────────── */
const features = [
  { Icon: Fish, text: "Landed on the morning tide." },
  { Icon: Flame, text: "Most of it cooked over embers." },
  { Icon: ForkKnife, text: "Twenty-eight seats, no fixed carte." },
];

const testimonials = [
  {
    quote:
      "No menu, just whatever the boats brought in. We trusted the kitchen and every plate was better than the last.",
    name: "Marta L.",
  },
  {
    quote:
      "Everything comes off the fire. The turbot on the bone was the best thing I have eaten on the waterfront.",
    name: "Diego R.",
  },
  {
    quote:
      "We shared the whole table and argued over the last carabinero. Exactly the kind of night you want.",
    name: "Claudia P.",
  },
  {
    quote:
      "Warm room, loud tables, and a kitchen that clearly cooks for the people it feeds. We are already booking again.",
    name: "Ander B.",
  },
];

/* ═══════════════════════════ Demo ═══════════════════════════ */
export function PlayfulHandcraftDemo() {
  const reduce = useReducedMotion();
  const track = useRef<HTMLDivElement>(null);

  const scrollReviews = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const amount = Math.min(el.clientWidth * 0.85, 420);
    el.scrollBy({ left: dir * amount, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <ParallaxProvider>
      <div
        className={cn(
          anton.variable,
          hanken.variable,
          caveat.variable,
          "min-h-[100dvh] overflow-x-clip bg-[#FBF2E2] font-[family-name:var(--font-hanken)] text-[#15171D] antialiased selection:bg-[#E64A2B] selection:text-[#FBF2E2]",
        )}
      >
        {/* ── Header ── */}
        <header className="relative z-40" style={inkTexture}>
          <div className="mx-auto flex max-w-[1340px] items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <Link
              href="/showcase"
              className="group inline-flex items-center gap-2 text-[13px] font-bold text-[#FBF2E2] transition-colors hover:text-[#F4A51C]"
            >
              <ArrowLeft aria-hidden weight="bold" className="size-4 transition-transform group-hover:-translate-x-1" />
              Showcase
            </Link>
            <span className={cn(display, "text-[clamp(1.1rem,2vw,1.5rem)] uppercase tracking-[0.04em] text-[#FBF2E2]")}>
              {meridia.name}
            </span>
            <StickerButton href="#visit" variant="coral" className="px-4 py-2 text-[13px] shadow-[4px_4px_0_#FBF2E2]">
              {meridia.ctaLabel}
            </StickerButton>
          </div>
        </header>

        {/* ── Hero: split, ink content + saffron media, cursor-parallax doodles ── */}
        <section className="relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
            {/* Content panel (ink) */}
            <div
              className="relative order-2 flex flex-col justify-center px-5 py-16 sm:px-10 lg:order-1 lg:min-h-[88vh] lg:py-20 lg:pr-16"
              style={inkTexture}
            >
              <Drift dx={-10} dy={-8} className="pointer-events-none absolute right-6 top-10 text-[#F4A51C] lg:right-10">
                <Spark className="w-9 opacity-80 sm:w-12" />
              </Drift>
              <Drift dx={14} dy={10} className="pointer-events-none absolute bottom-24 left-6 text-[#E64A2B]">
                <Wave className="w-20 opacity-70 sm:w-28" />
              </Drift>

              <div className="relative z-10 mx-auto w-full max-w-xl lg:mx-0">
                <Reveal y={16}>
                  <Eyebrow on="dark">Welcome to MERIDIA</Eyebrow>
                </Reveal>
                <Reveal delay={0.08} y={22}>
                  <h1
                    className={cn(
                      display,
                      "mt-5 text-[clamp(2.9rem,7vw,5.4rem)] uppercase leading-[0.92] tracking-[0.005em] text-[#FBF2E2]",
                    )}
                  >
                    Seasonal kitchen{" "}
                    <span className="text-[#F4A51C]">by the harbour</span>
                  </h1>
                </Reveal>

                <ul className="mt-10 grid gap-6 sm:grid-cols-3 sm:gap-5">
                  {features.map(({ Icon, text }, i) => (
                    <motion.li
                      key={text}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={reduce ? { duration: 0 } : { duration: 0.6, delay: 0.3 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                      className="flex flex-col gap-2.5"
                    >
                      <Icon aria-hidden weight="duotone" className="size-8 text-[#F4A51C]" />
                      <span className="text-[14px] leading-snug text-[#FBF2E2]/75">{text}</span>
                    </motion.li>
                  ))}
                </ul>

                <Reveal delay={0.5} y={18}>
                  <div className="mt-11">
                    <StickerButton href="#dishes" variant="coral">
                      See tonight&apos;s dishes
                      <ArrowRight aria-hidden weight="bold" className="size-5" />
                    </StickerButton>
                  </div>
                </Reveal>
              </div>

              {/* Scroll cue */}
              <motion.div
                aria-hidden
                className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 text-[#FBF2E2]/55 lg:block"
                initial={{ y: 0 }}
                animate={reduce ? { y: 0 } : { y: [0, 8, 0] }}
                transition={reduce ? { duration: 0 } : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              >
                <CaretDoubleDown weight="bold" className="size-6" />
              </motion.div>
            </div>

            {/* Media panel (saffron) */}
            <div
              className="relative order-1 min-h-[58vh] overflow-hidden px-6 py-12 sm:px-10 lg:order-2 lg:min-h-[88vh]"
              style={saffronTexture}
            >
              <Confetti />
              <Drift dx={-16} dy={-12} className="pointer-events-none absolute right-8 top-10 text-[#E64A2B]">
                <Flourish className="w-24 sm:w-32" />
              </Drift>
              <Drift dx={20} dy={14} className="pointer-events-none absolute bottom-10 right-12 text-[#15171D]">
                <Swoosh className="w-20 opacity-80 sm:w-28" />
              </Drift>

              <div className="relative z-10 flex h-full items-center justify-center">
                <Drift dx={-14} dy={-10}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92, rotate: -6 }}
                    animate={{ opacity: 1, scale: 1, rotate: -3 }}
                    transition={reduce ? { duration: 0 } : { duration: 1, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                    className="relative aspect-[4/5] w-[clamp(240px,70vw,420px)] overflow-hidden rounded-[46%_54%_52%_48%/48%_46%_54%_52%] border-[6px] border-[#FBF2E2] shadow-[10px_10px_0_rgba(21,23,29,0.9)]"
                  >
                    <Image
                      src={pics.hero}
                      alt="A plated dish at MERIDIA, cooked over fire by the harbour"
                      fill
                      preload
                      sizes="(min-width: 1024px) 42vw, 80vw"
                      className="object-cover"
                    />
                  </motion.div>
                </Drift>
              </div>
            </div>
          </div>
        </section>

        {/* ── Signature dishes: floating circular cutouts that drift ── */}
        <section id="dishes" className="relative scroll-mt-20 px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-[1200px] text-center">
            <Reveal y={16}>
              <div className="flex justify-center">
                <Eyebrow>Authentic flavours</Eyebrow>
              </div>
            </Reveal>
            <Reveal delay={0.06}>
              <h2 className={cn(display, "mx-auto mt-5 max-w-[16ch] text-[clamp(2.3rem,5.5vw,4.4rem)] uppercase leading-[0.92] text-[#15171D]")}>
                Plates that win every table
              </h2>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="mx-auto mt-6 max-w-xl text-[16px] leading-relaxed text-[#15171D]/65">
                One menu, written each afternoon around the market and the tide. Four of tonight&apos;s courses.
              </p>
            </Reveal>

            <ul className="mt-16 grid grid-cols-2 gap-x-6 gap-y-12 sm:gap-x-10 lg:grid-cols-4">
              {meridia.dishes.map((d, i) => (
                <motion.li
                  key={d.name}
                  initial={{ opacity: 0, y: 34 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.6, delay: (i % 4) * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col items-center"
                >
                  <Drift dx={i % 2 === 0 ? 10 : -10} dy={i % 2 === 0 ? -8 : 8}>
                    <motion.div
                      whileHover={reduce ? undefined : { y: -8, rotate: i % 2 === 0 ? 2 : -2, transition: spring }}
                      className="relative aspect-square w-[128px] overflow-hidden rounded-full border-[5px] border-[#FBF2E2] shadow-[6px_6px_0_rgba(21,23,29,0.85)] sm:w-[168px]"
                    >
                      <Image
                        src={pics.dishes[i]}
                        alt={`${d.name} at MERIDIA`}
                        fill
                        sizes="(min-width: 640px) 168px, 128px"
                        className="object-cover"
                      />
                    </motion.div>
                  </Drift>
                  <span className={cn(display, "mt-6 text-[clamp(1.3rem,2.6vw,1.75rem)] uppercase leading-none text-[#15171D]")}>
                    {d.name}
                  </span>
                  <span className="mt-2 text-[14px] text-[#15171D]/60">{d.note}</span>
                </motion.li>
              ))}
            </ul>

            <Reveal delay={0.1}>
              <div className="mt-16 flex justify-center">
                <StickerButton href="#visit" variant="ink">
                  See the menu
                  <ArrowUpRight aria-hidden weight="bold" className="size-5" />
                </StickerButton>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Editorial: tradition and fire, asymmetric photo pair ── */}
        <section className="relative px-5 pb-24 sm:px-8 sm:pb-28" style={{ backgroundColor: CREAM }}>
          <TornEdge color={CREAM} />
          <div className="mx-auto grid max-w-[1200px] items-center gap-10 pt-8 lg:grid-cols-12 lg:gap-14">
            <Reveal className="lg:col-span-6">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[8px] border-[5px] border-[#15171D] shadow-[10px_10px_0_#F4A51C]">
                <Image
                  src={pics.fire}
                  alt="Meat and seafood cooking over open fire at MERIDIA"
                  fill
                  sizes="(min-width: 1024px) 46vw, 100vw"
                  className="object-cover"
                />
              </div>
            </Reveal>
            <div className="lg:col-span-6">
              <Reveal y={16}>
                <Eyebrow>Tradition and fire</Eyebrow>
              </Reveal>
              <Reveal delay={0.06}>
                <h2 className={cn(display, "mt-5 text-[clamp(2.2rem,4.8vw,3.9rem)] uppercase leading-[0.94] text-[#15171D]")}>
                  Passion, served at your table
                </h2>
              </Reveal>
              <Reveal delay={0.12}>
                <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-[#15171D]/70">{meridia.about}</p>
              </Reveal>
              <Reveal delay={0.18}>
                <p className={cn(marker, "mt-6 text-[clamp(1.5rem,3vw,2.1rem)] leading-tight text-[#C43A1E]")}>
                  {meridia.quote.text}
                </p>
                <p className="mt-2 text-[13px] font-bold uppercase tracking-[0.18em] text-[#15171D]/55">
                  {meridia.chef.name}, {meridia.chef.role}
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── Reviews carousel ── */}
        <section className="relative px-5 py-20 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-[1200px]">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <Reveal>
                <Eyebrow>Word of mouth</Eyebrow>
                <div className="mt-4 flex items-end gap-4">
                  <span className={cn(display, "text-[clamp(3rem,7vw,5rem)] uppercase leading-none text-[#15171D]")}>
                    Excellent
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-1.5" aria-hidden>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} weight="fill" className="size-6 text-[#F4A51C]" />
                  ))}
                </div>
                <p className="mt-3 text-[14px] text-[#15171D]/55">What guests say after a night at MERIDIA.</p>
              </Reveal>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => scrollReviews(-1)}
                  aria-label="Previous reviews"
                  className="grid size-12 place-items-center border-2 border-[#15171D] bg-[#FBF2E2] text-[#15171D] shadow-[4px_4px_0_#15171D] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E64A2B]"
                >
                  <ArrowLeft weight="bold" className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollReviews(1)}
                  aria-label="Next reviews"
                  className="grid size-12 place-items-center border-2 border-[#15171D] bg-[#E64A2B] text-[#15171D] shadow-[4px_4px_0_#15171D] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15171D]"
                >
                  <ArrowRight weight="bold" className="size-5" />
                </button>
              </div>
            </div>

            <div
              ref={track}
              className="mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {testimonials.map((t) => (
                <article
                  key={t.name}
                  className="flex w-[300px] shrink-0 snap-start flex-col justify-between border-2 border-[#15171D] bg-[#FFF9EF] p-7 shadow-[6px_6px_0_#15171D] sm:w-[360px]"
                >
                  <Quotes aria-hidden weight="fill" className="size-8 text-[#E64A2B]" />
                  <p className="mt-4 text-[16px] leading-relaxed text-[#15171D]/85">{t.quote}</p>
                  <div className="mt-6 flex items-center justify-between border-t-2 border-dashed border-[#15171D]/20 pt-4">
                    <span className="text-[14px] font-bold text-[#15171D]">{t.name}</span>
                    <span className="flex gap-0.5" aria-hidden>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} weight="fill" className="size-4 text-[#F4A51C]" />
                      ))}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Photo mosaic band with a sticker label on hover ── */}
        <section className="group relative">
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2 lg:grid-cols-4">
            <div className="relative col-span-2 row-span-2 aspect-square lg:aspect-auto">
              <Image src={pics.harbour} alt="The harbour beside MERIDIA" fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
              <div className="pointer-events-none absolute left-5 top-5 border-2 border-[#15171D] bg-[#F4A51C] px-4 py-2 shadow-[4px_4px_0_#15171D] transition-transform duration-500 group-hover:-translate-y-1">
                <span className={cn(display, "block text-[1.3rem] uppercase leading-none text-[#15171D]")}>MERIDIA</span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#15171D]/70">Seasonal harbour kitchen</span>
              </div>
            </div>
            <div className="relative aspect-square">
              <Image src={pics.fire} alt="Fire in the MERIDIA kitchen" fill sizes="25vw" className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105" />
            </div>
            <div className="relative aspect-square">
              <Image src={pics.feature} alt="A finished plate at MERIDIA" fill sizes="25vw" className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105" />
            </div>
            <div className="relative col-span-2 aspect-[2/1]">
              <Image src={pics.room} alt="The MERIDIA dining room" fill sizes="50vw" className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105" />
            </div>
          </div>
        </section>

        {/* ── Dark CTA with doodles, torn into saffron below ── */}
        <section className="relative overflow-hidden px-5 py-28 text-center sm:px-8 sm:py-36" style={inkTexture}>
          <Drift dx={16} dy={12} className="pointer-events-none absolute left-6 top-14 text-[#FBF2E2]/70 sm:left-16">
            <Fishy className="w-24 sm:w-36" />
          </Drift>
          <Drift dx={-14} dy={10} className="pointer-events-none absolute bottom-20 right-6 text-[#FBF2E2]/70 sm:right-16">
            <Sprig className="w-14 sm:w-20" />
          </Drift>
          <Drift dx={10} dy={-10} className="pointer-events-none absolute right-10 top-16 text-[#F4A51C]">
            <Spark className="w-10 opacity-80" />
          </Drift>

          <div className="relative z-10 mx-auto max-w-[900px]">
            <Reveal y={16}>
              <Eyebrow on="dark">MERIDIA awaits</Eyebrow>
            </Reveal>
            <Reveal delay={0.06}>
              <h2 className={cn(display, "mx-auto mt-6 max-w-[18ch] text-[clamp(2.6rem,7vw,5.6rem)] uppercase leading-[0.9] text-[#FBF2E2]")}>
                We will keep the <span className="text-[#F4A51C]">fire lit</span> for you
              </h2>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="mx-auto mt-6 max-w-md text-[16px] leading-relaxed text-[#FBF2E2]/70">
                Tuesday to Saturday, from seven. Pull up a chair on the waterfront.
              </p>
            </Reveal>
            <Reveal delay={0.18}>
              <div className="mt-10 flex justify-center">
                <StickerButton href="#visit" variant="coral">
                  {meridia.ctaLabel}
                  <ArrowUpRight aria-hidden weight="bold" className="size-5" />
                </StickerButton>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Saffron feature: a passion for the tide ── */}
        <section className="relative overflow-hidden px-5 py-24 sm:px-8 sm:py-28" style={saffronTexture}>
          <TornEdge color={SAFFRON} />
          <Confetti className="opacity-80" />
          <div className="relative z-10 mx-auto grid max-w-[1200px] items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="relative flex justify-center">
              <Drift dx={-12} dy={-8}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, rotate: 6 }}
                  whileInView={{ opacity: 1, scale: 1, rotate: 3 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                  className="relative aspect-square w-[clamp(260px,72vw,440px)] overflow-hidden rounded-full border-[6px] border-[#FBF2E2] shadow-[12px_12px_0_rgba(21,23,29,0.9)]"
                >
                  <Image
                    src={pics.feature}
                    alt="A seasonal plate at MERIDIA"
                    fill
                    sizes="(min-width: 1024px) 40vw, 80vw"
                    className="object-cover"
                  />
                </motion.div>
              </Drift>
              <Drift dx={18} dy={12} className="pointer-events-none absolute -top-2 right-6 text-[#E64A2B]">
                <Flourish className="w-24 sm:w-32" />
              </Drift>
            </div>

            <div>
              <Reveal y={16}>
                <Eyebrow>100% seasonal</Eyebrow>
              </Reveal>
              <Reveal delay={0.06}>
                <h2 className={cn(display, "mt-5 text-[clamp(2.2rem,5vw,4rem)] uppercase leading-[0.92] text-[#15171D]")}>
                  A passion for what the tide brings
                </h2>
              </Reveal>
              <Reveal delay={0.12}>
                <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-[#15171D]/75">
                  {meridia.intro} Shellfish from the morning boats, vegetables from the garden, and a fire that runs
                  from the first plate to the last.
                </p>
              </Reveal>
              <Reveal delay={0.18}>
                <div className="mt-9">
                  <StickerButton href="#visit" variant="ink">
                    {meridia.ctaLabel}
                    <ArrowUpRight aria-hidden weight="bold" className="size-5" />
                  </StickerButton>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── Visit ── */}
        <section id="visit" className="relative scroll-mt-20 px-5 py-24 sm:px-8 sm:py-32" style={inkTexture}>
          <TornEdge color={INK} />
          <div className="mx-auto grid max-w-[1200px] gap-14 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <Reveal y={16}>
                <Eyebrow on="dark">Find the table</Eyebrow>
              </Reveal>
              <Reveal delay={0.06}>
                <h2 className={cn(display, "mt-5 text-[clamp(2.6rem,6vw,4.6rem)] uppercase leading-[0.9] text-[#FBF2E2]")}>
                  Come and eat with us
                </h2>
              </Reveal>
              <Reveal delay={0.12}>
                <p className="mt-6 max-w-sm text-[16px] leading-relaxed text-[#FBF2E2]/70">
                  Twenty-eight seats on the Valencia waterfront. Call or write and we will hold a place.
                </p>
                <div className="mt-10 space-y-5">
                  <div className="flex items-start gap-3">
                    <MapPin aria-hidden weight="fill" className="mt-0.5 size-5 shrink-0 text-[#F4A51C]" />
                    <p className="text-[17px] font-semibold text-[#FBF2E2]">
                      {meridia.address.street}
                      <br />
                      {meridia.address.city}
                    </p>
                  </div>
                  <a href={meridia.contact.phoneHref} className="group flex items-center gap-3">
                    <Phone aria-hidden weight="fill" className="size-5 shrink-0 text-[#F4A51C]" />
                    <span className="text-[17px] font-semibold text-[#FBF2E2] transition-colors group-hover:text-[#F4A51C]">
                      {meridia.contact.phone}
                    </span>
                  </a>
                  <a href={`mailto:${meridia.contact.email}`} className="group flex items-center gap-3">
                    <EnvelopeSimple aria-hidden weight="fill" className="size-5 shrink-0 text-[#F4A51C]" />
                    <span className="text-[17px] font-semibold text-[#FBF2E2] transition-colors group-hover:text-[#F4A51C]">
                      {meridia.contact.email}
                    </span>
                  </a>
                </div>
              </Reveal>
            </div>

            <div className="lg:col-span-5 lg:col-start-8">
              <Reveal delay={0.1}>
                <div className="flex items-center gap-2">
                  <Clock aria-hidden weight="fill" className="size-5 text-[#F4A51C]" />
                  <span className="text-[13px] font-extrabold uppercase tracking-[0.2em] text-[#FBF2E2]/70">Hours</span>
                </div>
                <dl className="mt-6 divide-y divide-[#FBF2E2]/15 border-y border-[#FBF2E2]/15">
                  {meridia.hours.map((h) => (
                    <div key={h.days} className="flex items-baseline justify-between gap-6 py-5">
                      <dt className="text-[17px] font-bold text-[#FBF2E2]">{h.days}</dt>
                      <dd className="text-right text-[15px] text-[#FBF2E2]/70">{h.detail}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-8">
                  <StickerButton href={meridia.contact.phoneHref} variant="coral">
                    {meridia.ctaLabel}
                    <ArrowUpRight aria-hidden weight="bold" className="size-5" />
                  </StickerButton>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="px-5 pb-14 pt-10 sm:px-8" style={inkTexture}>
          <div className="mx-auto flex max-w-[1200px] flex-col gap-8 border-t border-[#FBF2E2]/15 pt-10 md:flex-row md:items-end md:justify-between">
            <span className={cn(display, "text-[clamp(2.4rem,6vw,4rem)] uppercase leading-none text-[#FBF2E2]")}>
              {meridia.name}
            </span>
            <div className="flex flex-col gap-3 text-[13px] md:items-end">
              <a
                href={meridia.social.href}
                className="group inline-flex items-center gap-2 font-semibold text-[#FBF2E2] transition-colors hover:text-[#F4A51C]"
              >
                <InstagramLogo aria-hidden weight="fill" className="size-4" />
                {meridia.social.label}
              </a>
              <span className="text-[#FBF2E2]/50">Fictional demo · MangoCat Studios</span>
            </div>
          </div>
        </footer>
      </div>
    </ParallaxProvider>
  );
}
