"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "@phosphor-icons/react/dist/ssr";
import { site, reserveCta } from "@/config";
import { Button } from "@/components/ui/Button";
import { SocialLinks } from "./SocialLinks";

export function MobileMenu({
  open,
  onClose,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  pathname: string;
}) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);

  // Scroll lock while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Focus trap + Esc + initial/return focus
  useEffect(() => {
    if (!open) return;
    const node = panelRef.current;
    if (!node) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusable = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);

    focusable()[0]?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const f = focusable();
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  const links = [...site.nav, { label: "Reservations", href: reserveCta.href }];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          id="mobile-menu"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-[100] flex flex-col overflow-y-auto overscroll-contain bg-noir lg:hidden"
          style={{
            paddingTop: "env(safe-area-inset-top)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.15 : 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex h-16 items-center justify-between px-5 sm:px-8">
            <Link
              href="/"
              onClick={onClose}
              className="font-display text-2xl tracking-[0.14em] text-porcelain"
            >
              {site.wordmark}
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="inline-flex size-11 items-center justify-center text-porcelain transition-colors hover:text-ember touch-manip"
            >
              <X weight="light" className="size-6" aria-hidden="true" />
            </button>
          </div>

          <nav
            aria-label="Primary"
            className="flex flex-1 flex-col justify-center px-5 sm:px-8"
          >
            <motion.ul
              className="space-y-2"
              initial="hidden"
              animate="show"
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
              }}
            >
              {links.map((l) => {
                const active = pathname === l.href;
                return (
                  <motion.li
                    key={l.href}
                    variants={{
                      hidden: { opacity: 0, y: reduce ? 0 : 18 },
                      show: {
                        opacity: 1,
                        y: 0,
                        transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
                      },
                    }}
                  >
                    <Link
                      href={l.href}
                      onClick={onClose}
                      aria-current={active ? "page" : undefined}
                      className={`block font-display text-[2.75rem] leading-[1.15] transition-colors duration-300 ${
                        active ? "text-ember" : "text-porcelain hover:text-ember"
                      }`}
                    >
                      {l.label}
                    </Link>
                  </motion.li>
                );
              })}
            </motion.ul>
          </nav>

          <div className="border-t border-line px-5 py-8 sm:px-8">
            {/* Navigating closes the menu via Nav's route-change effect. */}
            <Button href={reserveCta.href} className="w-full">
              {reserveCta.label}
            </Button>
            <div className="mt-8 flex items-center justify-between">
              <div className="space-y-1 font-sans text-sm text-mist">
                <a href={site.contact.phoneHref} className="nums block hover:text-porcelain">
                  {site.contact.phoneDisplay}
                </a>
                <a
                  href={`mailto:${site.contact.email}`}
                  className="block hover:text-porcelain"
                >
                  {site.contact.email}
                </a>
              </div>
              <SocialLinks />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
