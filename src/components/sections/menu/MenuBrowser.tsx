"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { menu } from "@/config";
import type { DietaryCode } from "@/config";
import { Container } from "@/components/ui/Container";
import { DietaryTags } from "@/components/ui/DietaryTags";
import { Reveal } from "@/components/motion/Reveal";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

const DIET_FILTERS: { code: DietaryCode; label: string }[] = [
  { code: "v", label: "Vegetarian" },
  { code: "vg", label: "Vegan" },
  { code: "gf", label: "Gluten free" },
];

export function MenuBrowser() {
  const router = useRouter();
  const [dietArr, setDietArr] = useState<DietaryCode[]>([]);
  const activeDiet = new Set(dietArr);
  const [activeCat, setActiveCat] = useState(menu.categories[0].id);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Restore the filter from the URL on mount (deep-link support) without
  // forcing the whole menu to client-render (keeps the menu in SSR HTML / SEO).
  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get("diet");
    if (d) setDietArr(d.split(",").filter(Boolean) as DietaryCode[]);
  }, []);

  // Scroll-spy: highlight the category nearest the viewport middle.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveCat((e.target as HTMLElement).id);
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const toggleDiet = useCallback(
    (code: DietaryCode) => {
      const next = dietArr.includes(code)
        ? dietArr.filter((c) => c !== code)
        : [...dietArr, code];
      setDietArr(next);
      router.replace(next.length ? `/menu?diet=${next.join(",")}` : "/menu", {
        scroll: false,
      });
    },
    [dietArr, router],
  );

  const clearDiet = useCallback(() => {
    setDietArr([]);
    router.replace("/menu", { scroll: false });
  }, [router]);

  const matches = (tags?: DietaryCode[]) => {
    if (activeDiet.size === 0) return true;
    if (!tags) return false;
    for (const c of activeDiet) if (!tags.includes(c)) return false;
    return true;
  };

  const scrollTo = (id: string) => {
    const el = sectionRefs.current[id];
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  const anyVisible = menu.categories.some((c) => c.items.some((i) => matches(i.tags)));

  return (
    <section className="pb-28 lg:pb-40">
      {/* Sticky category navigation */}
      <div className="sticky top-16 z-30 border-y border-line bg-noir/90 backdrop-blur-md lg:top-[72px]">
        <Container>
          <nav
            aria-label="Menu categories"
            className="scrollbar-none -mx-1 flex items-center gap-x-6 overflow-x-auto py-4"
          >
            {menu.categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => scrollTo(c.id)}
                aria-current={activeCat === c.id ? "true" : undefined}
                className={cn(
                  "shrink-0 whitespace-nowrap px-1 font-sans text-xs font-medium uppercase tracking-[0.14em] transition-colors duration-300 touch-manip",
                  activeCat === c.id
                    ? "text-ember"
                    : "text-mist hover:text-porcelain",
                )}
              >
                {c.name}
              </button>
            ))}
          </nav>
        </Container>
      </div>

      {/* Dietary filter */}
      <Container className="mt-10 lg:mt-14">
        <div className="flex flex-wrap items-center gap-3">
          <span className="mr-1 font-sans text-xs uppercase tracking-[0.14em] text-ash">
            Filter
          </span>
          {DIET_FILTERS.map((f) => {
            const on = activeDiet.has(f.code);
            return (
              <button
                key={f.code}
                type="button"
                onClick={() => toggleDiet(f.code)}
                aria-pressed={on}
                className={cn(
                  "border px-4 py-2 font-sans text-xs uppercase tracking-[0.12em] transition-colors duration-300 touch-manip",
                  on
                    ? "border-ember bg-ember-soft text-ember"
                    : "border-line text-mist hover:border-porcelain hover:text-porcelain",
                )}
              >
                {f.label}
              </button>
            );
          })}
          {activeDiet.size > 0 && (
            <button
              type="button"
              onClick={clearDiet}
              className="font-sans text-xs uppercase tracking-[0.12em] text-ash underline-offset-4 transition-colors hover:text-porcelain hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      </Container>

      {/* Categories */}
      <Container className="mt-14">
        {!anyVisible && (
          <p
            className="py-24 text-center font-sans text-mist"
            aria-live="polite"
          >
            No dishes match that filter right now. Try removing a filter.
          </p>
        )}

        <div className="space-y-20 lg:space-y-28">
          {menu.categories.map((cat) => {
            const items = cat.items.filter((i) => matches(i.tags));
            if (items.length === 0) return null;
            return (
              <section
                key={cat.id}
                id={cat.id}
                ref={(el) => {
                  sectionRefs.current[cat.id] = el;
                }}
                aria-labelledby={`${cat.id}-h`}
                className="scroll-mt-32 lg:scroll-mt-40"
              >
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-16">
                  <div className="lg:col-span-4">
                    <h2
                      id={`${cat.id}-h`}
                      className="font-display text-[clamp(1.9rem,3vw,2.6rem)] leading-tight text-porcelain"
                    >
                      {cat.name}
                    </h2>
                    {cat.description && (
                      <p className="mt-3 max-w-xs font-sans text-sm leading-relaxed text-mist">
                        {cat.description}
                      </p>
                    )}
                  </div>

                  <ul className="space-y-10 lg:col-span-8 lg:border-l lg:border-line lg:pl-16">
                    {items.map((item) => (
                      <Reveal as="li" key={item.name}>
                        <div className="flex items-end gap-3">
                          <h3 className="min-w-0 font-display text-xl leading-tight text-porcelain md:text-[1.4rem]">
                            {item.name}
                            <DietaryTags tags={item.tags} className="ml-2" />
                          </h3>
                          <span
                            aria-hidden="true"
                            className="mb-1.5 flex-1 border-b border-dotted border-line"
                          />
                          <span className="nums shrink-0 font-sans text-base text-porcelain">
                            {formatPrice(item.price)}
                          </span>
                        </div>
                        <p className="mt-2 max-w-xl font-sans text-sm leading-relaxed text-mist">
                          {item.description}
                        </p>
                      </Reveal>
                    ))}
                  </ul>
                </div>
              </section>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
