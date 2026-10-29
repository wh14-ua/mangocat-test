"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCart } from "@/hooks/shang-hai/useCart";
import { useDialog } from "@/hooks/shang-hai/useDialog";
import { storefrontRoutes } from "@/lib/shang-hai/storefronts";
import { Seal } from "./Seal";
import { useInkUI } from "./InkUI";
import { CHAPTERS, PARTS } from "./chapters";

const routes = storefrontRoutes("ink-house");

/** Scrolls to an in-page anchor after overlays have released the scroll lock. */
export function goToAnchor(id: string, focus = true) {
  requestAnimationFrame(() => {
    const target = document.getElementById(id);
    if (!target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    if (focus) {
      const heading = target.querySelector<HTMLElement>("[data-anchor-focus]") ?? target;
      heading.focus({ preventScroll: true });
    }
  });
}

export function InkHeader({ variant = "full" }: { variant?: "full" | "compact" }) {
  const { itemCount } = useCart();
  const ui = useInkUI();
  const [indexOpen, setIndexOpen] = useState(false);

  const cartDetail =
    itemCount > 0 ? `, ${itemCount} ${itemCount === 1 ? "producto" : "productos"}` : ", vacío";

  return (
    <>
      <header className="ink-header" data-variant={variant}>
        <div className="ink-header__inner">
          <Link href={routes.home} className="ink-brand" aria-label="SHANG HAI, inicio">
            <Seal className="ink-brand__seal" />
            <span className="ink-brand__word" aria-hidden="true">
              SHANG HAI
            </span>
          </Link>

          {variant === "full" ? (
            <nav className="ink-nav" aria-label="Secciones">
              <a href="#carta" className="ink-nav__link">
                Carta
              </a>
              <a href="#informacion" className="ink-nav__link">
                Información
              </a>
              <a href="#contacto" className="ink-nav__link">
                Contacto
              </a>
            </nav>
          ) : (
            <nav className="ink-nav" aria-label="Secciones">
              <Link href={`${routes.home}#carta`} className="ink-nav__link ink-nav__link--always">
                <span className="ink-nav__long">Volver a la carta</span>
                <span className="ink-nav__short">La carta</span>
              </Link>
            </nav>
          )}

          <div className="ink-header__actions">
            <button
              type="button"
              className="ink-cart-trigger"
              data-testid="cart-open"
              aria-haspopup="dialog"
              aria-expanded={ui.cartOpen}
              onClick={ui.openCart}
            >
              <span className="ink-cart-trigger__label">Pedido</span>
              <span className="ink-sr-only">{cartDetail}</span>
              <span
                key={ui.stamp}
                className="ink-count"
                data-empty={itemCount === 0 ? "" : undefined}
                data-stamped={ui.stamp > 0 ? "" : undefined}
                aria-hidden="true"
              >
                {itemCount}
              </span>
            </button>
            {variant === "full" && (
              <button
                type="button"
                className="ink-index-trigger"
                aria-haspopup="dialog"
                aria-expanded={indexOpen}
                onClick={() => setIndexOpen(true)}
              >
                Índice
              </button>
            )}
          </div>
        </div>
      </header>
      {/* Outside the sticky header so it is not trapped in the header's stacking context. */}
      {variant === "full" && <InkIndexDialog open={indexOpen} onClose={() => setIndexOpen(false)} />}
    </>
  );
}

function InkIndexDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ui = useInkUI();
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const ref = useDialog<HTMLDivElement>(open, onClose, { initialFocus: closeRef });

  const go = (id: string) => {
    onClose();
    goToAnchor(id);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ink-index-title"
          className="ink-index-dialog"
          initial={reduce ? false : { clipPath: "inset(0 0 100% 0)" }}
          animate={{ clipPath: "inset(0 0 0% 0)" }}
          exit={reduce ? { opacity: 0 } : { clipPath: "inset(0 0 100% 0)" }}
          transition={{ duration: reduce ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="ink-index-dialog__top">
            <h2 id="ink-index-title" className="ink-index-dialog__title">
              Índice
            </h2>
            <button ref={closeRef} type="button" className="ink-close" onClick={onClose}>
              Cerrar
            </button>
          </div>
          <ul className="ink-index-dialog__main">
            <li>
              <button type="button" onClick={() => go("carta")}>
                La carta
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go("informacion")}>
                Información
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go("contacto")}>
                Contacto
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  ui.openCart();
                }}
              >
                Tu pedido
              </button>
            </li>
          </ul>
          <div className="ink-index-dialog__chapters">
            {PARTS.map((part) => (
              <section key={part.id} aria-label={part.title}>
                <p className="ink-index-dialog__part">{part.title}</p>
                <ol>
                  {part.chapters.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => go(c.anchor)}>
                        <span className="ink-num">{c.number}</span>
                        <span>{c.title}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
          <p className="ink-index-dialog__foot">{CHAPTERS.length} capítulos en la carta</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
