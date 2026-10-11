"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import type { ElementType, ReactNode } from "react";

/**
 * Fade + rise reveal on scroll into view. Isolated client leaf.
 * Collapses to a static, instant render under prefers-reduced-motion.
 * Motivation: draws the eye down the page in reading order (hierarchy).
 */
export function Reveal({
  children,
  as = "div",
  delay = 0,
  y = 28,
  className,
  once = true,
}: {
  children: ReactNode;
  as?: "div" | "span" | "li" | "section" | "figure";
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as] as ElementType;

  const variants: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : y },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount: 0.25 }}
      variants={variants}
    >
      {children}
    </MotionTag>
  );
}

/**
 * Staggered container: direct children animated via <RevealItem/>.
 */
export function RevealGroup({
  children,
  className,
  stagger = 0.09,
  once = true,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  once?: boolean;
  as?: "div" | "ul" | "section";
}) {
  const MotionTag = motion[as] as ElementType;
  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount: 0.2 }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger } },
      }}
    >
      {children}
    </MotionTag>
  );
}

export function RevealItem({
  children,
  className,
  y = 24,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  y?: number;
  as?: "div" | "li" | "figure";
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as] as ElementType;
  return (
    <MotionTag
      className={className}
      variants={{
        hidden: { opacity: 0, y: reduce ? 0 : y },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.75, ease: [0.16, 1, 0.3, 1] },
        },
      }}
    >
      {children}
    </MotionTag>
  );
}
