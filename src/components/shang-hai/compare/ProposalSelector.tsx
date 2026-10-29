"use client";

import { useEffect, useState } from "react";
import { STOREFRONTS } from "@/lib/shang-hai/storefronts";

/**
 * Sticky switcher for the comparison page: jumps between the three proposal sections
 * and marks the one in view. Plain anchors, so it works without JavaScript too.
 */
export function ProposalSelector() {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const sections = STOREFRONTS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => Boolean(el),
    );
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: [0, 0.25, 0.5] },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      aria-label="Ir a una propuesta"
      className="sticky top-0 z-40 border-b border-[#1d1b18]/10 bg-[#f6f4ef]/92 backdrop-blur-sm"
    >
      <ol className="mx-auto flex max-w-[1240px] gap-1 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] sm:px-8">
        {STOREFRONTS.map((s) => {
          const isActive = active === s.id;
          return (
            <li key={s.id} className="shrink-0">
              <a
                href={`#${s.id}`}
                aria-current={isActive ? "true" : undefined}
                className={
                  "flex items-baseline gap-2 rounded-full px-4 py-2 text-[14px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4621a] " +
                  (isActive
                    ? "bg-[#1d1b18] text-[#f6f4ef]"
                    : "text-[#3f3c36] hover:bg-[#1d1b18]/6 hover:text-[#1d1b18]")
                }
              >
                <span className={isActive ? "text-[#f0a35e]" : "text-[#9c4511]"}>{s.number}</span>
                {s.name}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
