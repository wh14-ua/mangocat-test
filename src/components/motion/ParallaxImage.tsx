"use client";

import Image from "next/image";
import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";

type Scrim = "none" | "soft" | "b" | "full";

/**
 * Full-bleed background photograph for heroes and bands. Combines a one-shot
 * intro scale (no infinite loop, so no autoplay-controls concern) with a subtle
 * scroll-driven parallax translate. Both are disabled under reduced motion.
 * The element is decorative background; real alt text still describes it.
 */
export function ParallaxImage({
  src,
  alt,
  priority = false,
  sizes = "100vw",
  scrim = "full",
  strength = 10,
  className,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  sizes?: string;
  scrim?: Scrim;
  /** parallax travel as a percentage of the frame height */
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(
    scrollYProgress,
    [0, 1],
    reduce ? ["0%", "0%"] : ["0%", `${strength}%`],
  );

  return (
    <div
      ref={ref}
      className={cn("absolute inset-0 overflow-hidden bg-noir", className)}
    >
      <motion.div
        className="absolute inset-x-0 -top-[8%] h-[116%]"
        style={{ y }}
      >
        <motion.div
          className="absolute inset-0"
          initial={{ scale: reduce ? 1 : 1.12 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <Image
            src={src}
            alt={alt}
            fill
            priority={priority}
            sizes={sizes}
            className="object-cover"
          />
        </motion.div>
      </motion.div>
      {scrim !== "none" && (
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 pointer-events-none",
            scrim === "full" && "scrim-full",
            scrim === "soft" && "scrim-soft",
            scrim === "b" && "scrim-b",
          )}
        />
      )}
    </div>
  );
}
