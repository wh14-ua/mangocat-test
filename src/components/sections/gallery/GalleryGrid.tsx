"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CaretLeft, CaretRight, X } from "@phosphor-icons/react/dist/ssr";
import { gallery } from "@/config";
import type { GalleryAspect } from "@/config";
import { Container } from "@/components/ui/Container";
import { cn } from "@/lib/cn";

const aspectClass: Record<GalleryAspect, string> = {
  portrait: "aspect-[4/5]",
  square: "aspect-square",
  landscape: "aspect-[3/2]",
};

// Representative dimensions per aspect so next/image keeps the ratio (no CLS).
const lightboxDims: Record<GalleryAspect, [number, number]> = {
  portrait: [1200, 1500],
  square: [1400, 1400],
  landscape: [1500, 1000],
};

export function GalleryGrid() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [view, setView] = useState("all");
  const [open, setOpen] = useState<number | null>(null);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Restore filter from URL on mount (deep-link) without forcing CSR.
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("view");
    if (v && gallery.filters.some((f) => f.id === v)) setView(v);
  }, []);

  const setFilter = useCallback(
    (id: string) => {
      setView(id);
      router.replace(id === "all" ? "/gallery" : `/gallery?view=${id}`, {
        scroll: false,
      });
    },
    [router],
  );

  const items = gallery.items.filter((i) => view === "all" || i.category === view);

  const close = useCallback(() => {
    setOpen((prev) => {
      if (prev !== null) thumbRefs.current[prev]?.focus();
      return null;
    });
  }, []);

  const go = useCallback(
    (dir: 1 | -1) => {
      setOpen((prev) =>
        prev === null ? prev : (prev + dir + items.length) % items.length,
      );
    },
    [items.length],
  );

  // Keyboard + scroll lock while the lightbox is open
  useEffect(() => {
    if (open === null) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Tab") {
        const node = dialogRef.current;
        if (!node) return;
        const f = Array.from(
          node.querySelectorAll<HTMLElement>("button"),
        ).filter((el) => el.offsetParent !== null);
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
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close, go]);

  const current = open !== null ? items[open] : null;

  return (
    <section className="pb-28 lg:pb-40">
      {/* Filters */}
      <Container>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-line py-4">
          {gallery.filters.map((f) => {
            const active = view === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={active}
                className={cn(
                  "font-sans text-xs font-medium uppercase tracking-[0.14em] transition-colors duration-300 touch-manip",
                  active ? "text-ember" : "text-mist hover:text-porcelain",
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </Container>

      {/* Masonry grid */}
      <Container className="mt-10 lg:mt-14">
        <div className="gap-4 [column-fill:_balance] sm:columns-2 lg:columns-3 lg:gap-6">
          {items.map((item, i) => (
            <figure key={item.src} className="mb-4 break-inside-avoid lg:mb-6">
              <button
                type="button"
                ref={(el) => {
                  thumbRefs.current[i] = el;
                }}
                onClick={() => setOpen(i)}
                aria-label={`View larger: ${item.alt}`}
                className="group relative block w-full overflow-hidden bg-coal touch-manip"
              >
                <div className={cn("relative w-full", aspectClass[item.aspect])}>
                  <Image
                    src={item.src}
                    alt={item.alt}
                    fill
                    priority={i < 3}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                  />
                  <div
                    className="pointer-events-none absolute inset-0 bg-noir/0 transition-colors duration-500 group-hover:bg-noir/20"
                    aria-hidden="true"
                  />
                </div>
              </button>
            </figure>
          ))}
        </div>
      </Container>

      {/* Lightbox */}
      <AnimatePresence>
        {current && open !== null && (
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Image viewer"
            className="fixed inset-0 z-[110] flex flex-col overscroll-contain bg-noir/97 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.12 : 0.3 }}
          >
            {/* Top bar */}
            <div className="flex items-center justify-between px-5 py-4 sm:px-8">
              <span className="nums font-sans text-xs tracking-[0.14em] text-mist">
                {open + 1} / {items.length}
              </span>
              <button
                type="button"
                onClick={close}
                aria-label="Close viewer"
                className="inline-flex size-11 items-center justify-center text-porcelain transition-colors hover:text-ember touch-manip"
              >
                <X weight="light" className="size-6" aria-hidden="true" />
              </button>
            </div>

            {/* Stage */}
            <div className="relative flex flex-1 items-center justify-center px-4 pb-4 sm:px-16">
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous image"
                className="absolute left-2 z-10 inline-flex size-12 items-center justify-center text-porcelain/70 transition-colors hover:text-ember touch-manip sm:left-4"
              >
                <CaretLeft weight="light" className="size-7" aria-hidden="true" />
              </button>

              <motion.figure
                key={current.src}
                className="relative flex max-h-full max-w-5xl flex-col items-center"
                initial={{ opacity: 0, scale: reduce ? 1 : 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: reduce ? 0.12 : 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <Image
                  src={current.src}
                  alt={current.alt}
                  width={lightboxDims[current.aspect][0]}
                  height={lightboxDims[current.aspect][1]}
                  sizes="90vw"
                  className="max-h-[78vh] w-auto object-contain"
                  priority
                />
                <figcaption className="mt-4 max-w-xl text-center font-sans text-sm text-mist">
                  {current.alt}
                </figcaption>
              </motion.figure>

              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next image"
                className="absolute right-2 z-10 inline-flex size-12 items-center justify-center text-porcelain/70 transition-colors hover:text-ember touch-manip sm:right-4"
              >
                <CaretRight weight="light" className="size-7" aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
