"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { featuredDishes } from "@/config";
import { Container } from "@/components/ui/Container";
import { TextReveal } from "@/components/motion/TextReveal";
import { RevealImage } from "@/components/motion/RevealImage";

/**
 * An offset index of this week's dishes. Hovering or keyboard-focusing a dish
 * crossfades a preview image (desktop). On mobile each dish carries its image
 * inline. Motivation: an editorial, tactile way to browse the kitchen's writing.
 */
export function FeaturedDishes() {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const activeDish = featuredDishes[active];

  return (
    <section className="border-t border-line py-24 lg:py-36">
      <Container>
        <div className="mb-14 max-w-3xl lg:mb-20">
          <TextReveal
            as="h2"
            lines={["From this week’s menu"]}
            className="font-display font-normal text-porcelain text-[clamp(2.3rem,4.4vw,3.5rem)] leading-[1.05]"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 lg:gap-16">
          <ul className="lg:col-span-7">
            {featuredDishes.map((d, i) => (
              <li
                key={d.name}
                className="group border-b border-line first:border-t"
              >
                <Link
                  href="/menu"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  className="flex items-center justify-between gap-6 py-6 lg:py-8"
                >
                  <span className="min-w-0">
                    <span className="block font-display text-[clamp(1.5rem,3vw,2.3rem)] leading-tight text-mist transition-colors duration-300 group-hover:text-porcelain group-focus-within:text-porcelain">
                      {d.name}
                    </span>
                    <span className="mt-2 block max-w-md font-sans text-sm text-ash">
                      {d.note}
                    </span>
                  </span>
                  <ArrowUpRight
                    weight="light"
                    aria-hidden="true"
                    className="size-6 shrink-0 -translate-x-2 text-ember opacity-0 transition-[opacity,transform] duration-300 group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100"
                  />
                </Link>

                <div className="pb-8 lg:hidden">
                  <RevealImage
                    src={d.image}
                    alt={d.name}
                    aspect="landscape"
                    sizes="100vw"
                  />
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden lg:col-span-5 lg:block" aria-hidden="true">
            <div className="sticky top-28">
              <div className="relative aspect-[3/4] overflow-hidden bg-coal">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeDish.image}
                    className="absolute inset-0"
                    initial={{ opacity: 0, scale: reduce ? 1 : 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Image
                      src={activeDish.image}
                      alt=""
                      fill
                      sizes="40vw"
                      className="object-cover"
                    />
                  </motion.div>
                </AnimatePresence>
                <div className="pointer-events-none absolute inset-0 scrim-soft" />
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
