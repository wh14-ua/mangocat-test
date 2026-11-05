"use client";

import { useCart } from "@/hooks/shang-hai/useCart";
import { useLocale } from "@/hooks/shang-hai/useLocale";
import { INK_TEXT } from "@/lib/shang-hai/i18n/ink-house";
import { useInkUI } from "./InkUI";
import { goToAnchor } from "./InkHeader";

export function InkHeroActions() {
  const { itemCount } = useCart();
  const ui = useInkUI();
  const t = INK_TEXT[useLocale().locale].hero;
  return (
    <div className="ink-hero__actions">
      <a
        href="#carta"
        data-testid="go-to-menu"
        className="ink-button ink-button--ink"
        onClick={(e) => {
          e.preventDefault();
          goToAnchor("carta");
          history.replaceState(null, "", "#carta");
        }}
      >
        {t.seeMenu}
      </a>
      <button
        type="button"
        className="ink-button ink-button--quiet"
        onClick={() => {
          if (itemCount > 0) ui.openCart();
          else {
            goToAnchor("carta", false);
            requestAnimationFrame(() =>
              document.getElementById("ink-search")?.focus({ preventScroll: true }),
            );
          }
        }}
      >
        {t.order}
      </button>
    </div>
  );
}
