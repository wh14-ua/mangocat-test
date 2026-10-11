"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import type { ElementType } from "react";
import { cn } from "@/lib/cn";

type HeadingTag = "h1" | "h2" | "h3" | "p" | "div" | "blockquote";

/**
 * Line-by-line reveal: each line rises from behind an overflow mask, staggered.
 *
 * Triggering is based on `useInView` observing the UNCLIPPED heading container,
 * not the line spans themselves. The spans start translated out of their own
 * `overflow-hidden` mask, so observing them directly would report ~0 visibility
 * (ancestor clipping counts) and never trigger. The text is real, selectable
 * text. Reduced motion renders it instantly in place.
 */
export function TextReveal({
  lines,
  as = "h2",
  className,
  lineClassName,
  delay = 0,
  stagger = 0.11,
  amount = 0.3,
}: {
  lines: string[];
  as?: HeadingTag;
  className?: string;
  lineClassName?: string;
  delay?: number;
  stagger?: number;
  amount?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount });
  const MotionTag = motion[as] as ElementType;
  const show = reduce || inView;

  return (
    <MotionTag ref={ref} className={className}>
      {lines.map((line, i) => (
        <span
          key={i}
          className={cn("block overflow-hidden pb-[0.06em]", lineClassName)}
        >
          <motion.span
            className="block"
            initial={false}
            animate={
              show
                ? { y: "0%", opacity: 1 }
                : { y: reduce ? "0%" : "115%", opacity: reduce ? 1 : 0 }
            }
            transition={{
              duration: reduce ? 0 : 0.95,
              delay: reduce ? 0 : delay + i * stagger,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </MotionTag>
  );
}
