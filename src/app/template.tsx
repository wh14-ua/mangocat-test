"use client";

import { motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Per-route enter transition (App Router re-mounts this on navigation).
 * A brief fade + rise. Disabled entirely under reduced motion.
 *
 * The Shang Hai proposals are skipped: each one choreographs its own first paint, and
 * their server HTML must be visible before hydration (this wrapper starts at opacity 0).
 */
export default function Template({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const pathname = usePathname();
  if (pathname === "/showcase/shang-hai" || pathname?.startsWith("/showcase/shang-hai/")) {
    return <>{children}</>;
  }
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
