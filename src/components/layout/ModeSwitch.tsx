"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowsLeftRight } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";

/**
 * A persistent "dual site" switch, rendered on every route by SiteChrome.
 *
 * It lets a visitor move between the two things this project presents: the flagship
 * professional restaurant site (ATELIER, at `/`) and the MangoCat Studios Design
 * Showcase (the catalog and its demos, under `/showcase`). The segmented pill makes
 * it obvious the two can be switched. Styling is self-contained (fixed, dark glass)
 * so it reads on both ATELIER's dark pages and the light showcase pages, and it never
 * depends on either side's chrome.
 */
export function ModeSwitch() {
  const pathname = usePathname();
  const isShowcase =
    pathname === "/showcase" || (pathname?.startsWith("/showcase/") ?? false);

  const seg = (active: boolean) =>
    cn(
      "rounded-full px-4 py-2 text-[13px] font-semibold tracking-wide transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8812B] sm:px-5",
      active ? "bg-[#E8812B] text-[#141416]" : "text-white/60 hover:text-white",
    );

  return (
    <nav
      aria-label="Cambiar entre el sitio ATELIER y el Design Showcase"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4 sm:bottom-5"
    >
      <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-[#141416]/90 p-1 pl-3 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.6)] ring-1 ring-white/15 backdrop-blur-md">
        <ArrowsLeftRight aria-hidden weight="bold" className="mr-0.5 size-4 shrink-0 text-[#E8812B]" />
        <Link href="/" aria-current={!isShowcase ? "page" : undefined} className={seg(!isShowcase)}>
          ATELIER
        </Link>
        <Link
          href="/showcase"
          aria-current={isShowcase ? "page" : undefined}
          className={seg(isShowcase)}
        >
          Showcase
        </Link>
      </div>
    </nav>
  );
}
