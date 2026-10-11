"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useScroll, useMotionValueEvent } from "motion/react";
import { List } from "@phosphor-icons/react/dist/ssr";
import { site, reserveCta } from "@/config";
import { Button } from "@/components/ui/Button";
import { MobileMenu } from "./MobileMenu";
import { cn } from "@/lib/cn";

export function Nav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => {
    setScrolled(y > 24);
  });

  // Close the mobile menu whenever the route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-colors duration-500",
          scrolled || open
            ? "border-b border-line bg-noir/85 backdrop-blur-md"
            : "border-b border-transparent bg-transparent",
        )}
      >
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:h-[72px] lg:px-10">
          {/* Wordmark */}
          <Link
            href="/"
            aria-label={`${site.name}, home`}
            className="font-display text-2xl tracking-[0.18em] text-porcelain transition-colors duration-300 hover:text-ember lg:text-[1.75rem]"
          >
            {site.wordmark}
          </Link>

          {/* Desktop navigation */}
          <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center gap-x-9">
              {site.nav.map((n) => {
                const active = pathname === n.href;
                return (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "link-underline pb-1 font-sans text-[0.8125rem] font-medium tracking-[0.02em] transition-colors duration-300",
                        active ? "text-ember" : "text-mist hover:text-porcelain",
                      )}
                    >
                      {n.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Desktop CTA */}
          <div className="hidden lg:block">
            <Button href={reserveCta.href} size="md">
              {reserveCta.label}
            </Button>
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="mobile-menu"
            className="inline-flex size-11 items-center justify-center text-porcelain transition-colors hover:text-ember touch-manip lg:hidden"
          >
            <List weight="light" className="size-6" aria-hidden="true" />
          </button>
        </div>
      </header>

      <MobileMenu open={open} onClose={() => setOpen(false)} pathname={pathname} />
    </>
  );
}
