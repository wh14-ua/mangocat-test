"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCart } from "@/hooks/shang-hai/useCart";
import { useDialog } from "@/hooks/shang-hai/useDialog";
import { useLocale } from "@/hooks/shang-hai/useLocale";
import { INK_TEXT } from "@/lib/shang-hai/i18n/ink-house";
import { storefrontRoutes } from "@/lib/shang-hai/storefronts";
import { Seal } from "./Seal";
import { useInkUI } from "./InkUI";
import { InkLanguageSwitch } from "./InkLanguageSwitch";
import { CHAPTERS, PARTS, chapterTitle, partTitle } from "./chapters";

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
  const { locale } = useLocale();
  const t = INK_TEXT[locale].header;
  const [indexOpen, setIndexOpen] = useState(false);

  return (
    <>
      <header className="ink-header" data-variant={variant}>
        <div className="ink-header__inner">
          <Link href={routes.home} className="ink-brand" aria-label={t.home}>
            <Seal className="ink-brand__seal" />
            <span className="ink-brand__word" aria-hidden="true">
              SHANG HAI
            </span>
          </Link>

          {variant === "full" ? (
            <nav className="ink-nav" aria-label={t.sections}>
              <a href="#carta" className="ink-nav__link">
                {t.menu}
              </a>
              <a href="#informacion" className="ink-nav__link">
                {t.info}
              </a>
              <a href="#contacto" className="ink-nav__link">
                {t.contact}
              </a>
            </nav>
          ) : (
            <nav className="ink-nav" aria-label={t.sections}>
              <Link href={`${routes.home}#carta`} className="ink-nav__link ink-nav__link--always">
                <span className="ink-nav__long">{t.backToMenu}</span>
                <span className="ink-nav__short">{t.backToMenuShort}</span>
              </Link>
            </nav>
          )}

          <div className="ink-header__actions">
            <InkLanguageSwitch />
            <button
              type="button"
              className="ink-cart-trigger"
              data-testid="cart-open"
              aria-haspopup="dialog"
              aria-expanded={ui.cartOpen}
              onClick={ui.openCart}
            >
              <span className="ink-cart-trigger__label">{t.order}</span>
              <span className="ink-sr-only">{t.orderDetail(itemCount)}</span>
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
                {t.index}
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
  const { locale } = useLocale();
  const t = INK_TEXT[locale].index;
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
              {t.title}
            </h2>
            <div className="ink-index-dialog__tools">
              <InkLanguageSwitch />
              <button ref={closeRef} type="button" className="ink-close" onClick={onClose}>
                {t.close}
              </button>
            </div>
          </div>
          <ul className="ink-index-dialog__main">
            <li>
              <button type="button" onClick={() => go("carta")}>
                {t.menu}
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go("informacion")}>
                {t.info}
              </button>
            </li>
            <li>
              <button type="button" onClick={() => go("contacto")}>
                {t.contact}
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
                {t.yourOrder}
              </button>
            </li>
          </ul>
          <div className="ink-index-dialog__chapters">
            {PARTS.map((part) => (
              <section key={part.id} aria-label={partTitle(part, locale)}>
                <p className="ink-index-dialog__part">{partTitle(part, locale)}</p>
                <ol>
                  {part.chapters.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => go(c.anchor)}>
                        <span className="ink-num">{c.number}</span>
                        <span>{chapterTitle(c, locale)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
          <p className="ink-index-dialog__foot">{t.chapterCount(CHAPTERS.length)}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
