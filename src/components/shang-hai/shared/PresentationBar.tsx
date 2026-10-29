"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { SHANG_HAI_BASE_PATH, STOREFRONTS, storefrontRoutes, type StorefrontId } from "@/lib/shang-hai/storefronts";

const subscribe = () => () => {};
const readHidden = () =>
  new URLSearchParams(window.location.search).get("presentacion") === "0";

/**
 * MangoCat presentation bar: a slim, neutral strip ABOVE each proposal (in the page flow,
 * never floating over the design) to jump between the three proposals and the
 * comparison page. Deliberately styled outside the three identities.
 * Hidden with ?presentacion=0 (used for clean screenshots).
 */
export function PresentationBar({ current }: { current: StorefrontId }) {
  const hidden = useSyncExternalStore(subscribe, readHidden, () => false);
  if (hidden) return null;
  return (
    <nav
      aria-label="Propuestas de MangoCat Studios para Shang Hai"
      className="relative z-[70] flex h-9 items-center gap-3 overflow-x-auto bg-[#1c1c1e] px-3 font-sans text-[12px] leading-none text-white/70 [scrollbar-width:none] sm:px-4"
      style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" }}
    >
      <Link
        href={`${SHANG_HAI_BASE_PATH}/`}
        className="shrink-0 whitespace-nowrap rounded px-1.5 py-1 text-white/85 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#E8812B]"
      >
        <span className="font-semibold text-[#E8812B]">MangoCat</span>
        <span className="hidden sm:inline"> · Propuestas para Shang Hai</span>
      </Link>
      <span aria-hidden className="h-4 w-px shrink-0 bg-white/15" />
      <ul className="flex shrink-0 items-center gap-1">
        {STOREFRONTS.map((s) => {
          const active = s.id === current;
          return (
            <li key={s.id}>
              <Link
                href={storefrontRoutes(s.id).home}
                aria-current={active ? "page" : undefined}
                className={
                  "block whitespace-nowrap rounded px-2 py-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#E8812B] " +
                  (active ? "bg-white/12 text-white" : "hover:bg-white/8 hover:text-white")
                }
              >
                <span className="tabular-nums text-white/45">{s.number}</span>{" "}
                <span>{s.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link
        href={`${SHANG_HAI_BASE_PATH}/`}
        className="ml-auto hidden shrink-0 whitespace-nowrap rounded px-2 py-1.5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8812B] md:block"
      >
        Comparar propuestas
      </Link>
    </nav>
  );
}
