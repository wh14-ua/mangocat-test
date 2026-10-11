"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";

type Aspect = "portrait" | "tall" | "square" | "landscape" | "wide" | "free";
type Scrim = "none" | "soft" | "b" | "full";

const aspectClass: Record<Aspect, string> = {
  portrait: "aspect-[4/5]",
  tall: "aspect-[3/4]",
  square: "aspect-square",
  landscape: "aspect-[16/10]",
  wide: "aspect-[16/9]",
  free: "",
};

/**
 * A sharp-framed editorial image that scales in and fades as it enters view.
 * Uses next/image `fill` so no intrinsic dimensions are needed (no CLS from the
 * frame, which reserves space via aspect-ratio). Reduced-motion: static.
 */
export function RevealImage({
  src,
  alt,
  aspect = "landscape",
  sizes = "100vw",
  priority = false,
  scrim = "none",
  className,
  rounded = false,
}: {
  src: string;
  alt: string;
  aspect?: Aspect;
  sizes?: string;
  priority?: boolean;
  scrim?: Scrim;
  className?: string;
  rounded?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-coal",
        aspectClass[aspect],
        rounded ? "" : "rounded-none",
        className,
      )}
    >
      <motion.div
        className="absolute inset-0"
        initial={{ scale: reduce ? 1 : 1.08, opacity: reduce ? 1 : 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
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
