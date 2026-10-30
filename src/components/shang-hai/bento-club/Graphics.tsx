import { useId } from "react";

/**
 * BENTO CLUB — original packaging illustrations. Flat shapes with a thick soft-black
 * print line, in the four packaging inks. Purely decorative (aria-hidden): they mark
 * a section the way icons are printed on a takeaway box, never stand in for a dish.
 */

const INK = "#22221F";
const CREAM = "#FFF8EA";
const BUTTER = "#F7DC72";
const TOMATO = "#E84E36";
const LIME = "#BCD967";

type ArtProps = { className?: string };

/** Maki roll in cross-section: nori, rice, salmon and avocado. */
export function MakiArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden focusable="false">
      <circle cx="50" cy="50" r="44" fill={INK} />
      <circle cx="50" cy="50" r="36" fill={CREAM} stroke={INK} strokeWidth="3" />
      <path d="M36 52c0-10 8-18 18-18 6 0 10 4 10 9 0 9-9 19-19 19-5 0-9-4-9-10z" fill={TOMATO} stroke={INK} strokeWidth="3" />
      <path d="M55 58c4-6 10-8 14-6 2 4-1 11-8 13-4 1-7-2-6-7z" fill={LIME} stroke={INK} strokeWidth="3" />
      <g fill={INK}>
        <circle cx="30" cy="34" r="1.8" />
        <circle cx="70" cy="34" r="1.8" />
        <circle cx="26" cy="58" r="1.8" />
        <circle cx="44" cy="76" r="1.8" />
        <circle cx="72" cy="72" r="1.8" />
      </g>
    </svg>
  );
}

/** A pleated dumpling. */
export function DumplingArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 84" className={className} aria-hidden focusable="false">
      <path d="M8 66C14 30 40 12 60 12s46 18 52 54c-16 8-34 12-52 12S24 74 8 66z" fill={CREAM} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M30 26c4 8 4 14 2 20M46 17c3 9 3 16 1 23M62 14c2 9 2 17 0 25M78 18c-1 9-2 16-4 22M93 27c-3 8-5 13-8 18" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M20 70c26 6 54 6 80 0" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" opacity=".35" />
    </svg>
  );
}

/** A bowl of noodles with chopsticks. */
export function BowlArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden focusable="false">
      <path d="M62 8 44 52M80 14 50 54" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <path d="M24 50c4-8 10-8 14 0s10 8 14 0 10-8 14 0 10 8 12 0" fill="none" stroke={BUTTER} strokeWidth="9" strokeLinecap="round" />
      <path d="M24 50c4-8 10-8 14 0s10 8 14 0 10-8 14 0 10 8 12 0" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" opacity=".55" />
      <path d="M10 54h80c0 22-18 38-40 38S10 76 10 54z" fill={TOMATO} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M24 66h52" stroke={CREAM} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/** A tumbler with a lime drink. */
export function GlassArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden focusable="false">
      <path d="M62 6 54 40" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <path d="M22 26h56l-7 64H29z" fill={CREAM} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M25 46h50l-4.6 42H29.6z" fill={LIME} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <g fill={CREAM} stroke={INK} strokeWidth="2.5">
        <circle cx="42" cy="62" r="4" />
        <circle cx="56" cy="72" r="3" />
        <circle cx="48" cy="80" r="2.5" />
      </g>
    </svg>
  );
}

/** A closed bento box held by a strip of tape. */
export function BoxArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 100" className={className} aria-hidden focusable="false">
      <rect x="8" y="22" width="104" height="66" rx="12" fill={BUTTER} stroke={INK} strokeWidth="4" />
      <rect x="4" y="14" width="112" height="22" rx="9" fill={CREAM} stroke={INK} strokeWidth="4" />
      <rect x="50" y="10" width="20" height="82" fill={TOMATO} stroke={INK} strokeWidth="4" />
      <path d="M50 30h20M50 50h20M50 70h20" stroke={INK} strokeWidth="2" opacity=".35" />
    </svg>
  );
}

/** Open, empty tray: the empty-order state. */
export function EmptyTrayArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 160 110" className={className} aria-hidden focusable="false">
      <rect x="6" y="8" width="148" height="94" rx="16" fill={BUTTER} stroke={INK} strokeWidth="4" />
      <rect x="16" y="18" width="62" height="74" rx="10" fill={CREAM} stroke={INK} strokeWidth="3" />
      <rect x="86" y="18" width="58" height="34" rx="10" fill={CREAM} stroke={INK} strokeWidth="3" />
      <rect x="86" y="58" width="27" height="34" rx="9" fill={CREAM} stroke={INK} strokeWidth="3" />
      <rect x="117" y="58" width="27" height="34" rx="9" fill={CREAM} stroke={INK} strokeWidth="3" />
      <path d="M30 104 128 4" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <path d="M40 106 136 10" stroke={INK} strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function SectionArt({ section, className }: { section: string; className?: string }) {
  switch (section) {
    case "para-compartir":
      return <BoxArt className={className} />;
    case "cocina-china":
      return <BowlArt className={className} />;
    case "sushi":
      return <MakiArt className={className} />;
    default:
      return <GlassArt className={className} />;
  }
}

/** Round packaging sticker with text set on a circle. */
export function PickupSticker({ className }: ArtProps) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden focusable="false">
      <defs>
        <path id={`bc-ring-${id}`} d="M60 60m-41 0a41 41 0 1 1 82 0a41 41 0 1 1-82 0" />
      </defs>
      <circle cx="60" cy="60" r="57" fill={TOMATO} stroke={INK} strokeWidth="3" />
      <circle cx="60" cy="60" r="29" fill={CREAM} stroke={INK} strokeWidth="3" />
      <text
        fill="#0E0E0C"
        style={{ fontFamily: "var(--bc-text)", fontWeight: 800, fontSize: 12.5, letterSpacing: "0.12em" }}
      >
        <textPath href={`#bc-ring-${id}`} startOffset="0">
          RECOGIDA EN EL LOCAL · ORIHUELA ·
        </textPath>
      </text>
      <path d="M48 56h24l-3 18H51z" fill={BUTTER} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M53 56c0-6 3-9 7-9s7 3 7 9" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
