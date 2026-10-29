"use client";

import { useCart } from "@/hooks/shang-hai/useCart";
import { useInkUI } from "./InkUI";
import { goToAnchor } from "./InkHeader";

export function InkHeroActions() {
  const { itemCount } = useCart();
  const ui = useInkUI();
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
        Ver la carta
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
        Hacer un pedido
      </button>
    </div>
  );
}
