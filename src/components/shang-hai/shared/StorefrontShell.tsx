import { CartProvider } from "@/hooks/shang-hai/useCart";
import type { StorefrontId } from "@/lib/shang-hai/storefronts";
import { DishPhotosProvider } from "./DishPhotos";
import { LocaleBootScript } from "./LocaleBoot";
import { LocaleRoot } from "./LocaleRoot";
import { PresentationBar } from "./PresentationBar";

/**
 * Common wrapper for the three storefronts: language scope (ES/EN), the MangoCat
 * presentation bar (outside the design), the dish-photo preference and the storefront's
 * own cart. Everything visual inside `children` belongs to the storefront.
 */
export function StorefrontShell({
  storefront,
  className,
  children,
}: {
  storefront: StorefrontId;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <LocaleBootScript />
      <LocaleRoot className={className} data-storefront={storefront}>
        <PresentationBar current={storefront} />
        <DishPhotosProvider>
          <CartProvider storefront={storefront}>{children}</CartProvider>
        </DishPhotosProvider>
      </LocaleRoot>
    </>
  );
}

/** Shared copy so all three proposals word the demo notice identically. */
export const DEMO_NOTICE = "Demostración — no se realizará ningún cargo";

export const DEMO_NOTICE_TEXT = {
  es: DEMO_NOTICE,
  en: "Demo — you will not be charged",
} as const;
