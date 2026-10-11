import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Eyebrow } from "./Eyebrow";
import { Reveal } from "@/components/motion/Reveal";
import { TextReveal } from "@/components/motion/TextReveal";

type Size = "sm" | "md" | "lg" | "xl";
type HeadingTag = "h1" | "h2" | "h3";

const sizePresets: Record<Size, string> = {
  sm: "text-[clamp(1.6rem,2.6vw,2.25rem)] leading-[1.1]",
  md: "text-[clamp(2rem,3.4vw,2.75rem)] leading-[1.08] tracking-[-0.01em]",
  lg: "text-[clamp(2.4rem,4.4vw,3.5rem)] leading-[1.04] tracking-[-0.01em]",
  xl: "text-[clamp(2.75rem,6vw,5rem)] leading-[1.0] tracking-[-0.015em]",
};

/**
 * Eyebrow (optional, rationed) + serif headline (line-revealed) + lead.
 */
export function SectionHeading({
  eyebrow,
  eyebrowTone = "ember",
  titleLines,
  as = "h2",
  size = "lg",
  lead,
  align = "left",
  className,
  titleClassName,
}: {
  eyebrow?: string;
  eyebrowTone?: "ember" | "mist";
  titleLines: string[];
  as?: HeadingTag;
  size?: Size;
  lead?: ReactNode;
  align?: "left" | "center";
  className?: string;
  titleClassName?: string;
}) {
  return (
    <div className={cn(align === "center" && "text-center", className)}>
      {eyebrow && (
        <Reveal className={cn("mb-5", align === "center" && "flex justify-center")}>
          <Eyebrow tone={eyebrowTone}>{eyebrow}</Eyebrow>
        </Reveal>
      )}
      <TextReveal
        as={as}
        lines={titleLines}
        delay={eyebrow ? 0.05 : 0}
        className={cn(
          "font-display font-normal text-porcelain",
          sizePresets[size],
          titleClassName,
        )}
      />
      {lead && (
        <Reveal as="div" delay={0.12}>
          <p
            className={cn(
              "mt-6 max-w-[56ch] font-sans text-[clamp(1.05rem,1.4vw,1.2rem)] leading-[1.7] text-mist",
              align === "center" && "mx-auto",
            )}
          >
            {lead}
          </p>
        </Reveal>
      )}
    </div>
  );
}
