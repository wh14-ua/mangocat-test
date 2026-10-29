import { CartProvider } from "@/hooks/shang-hai/useCart";
import type { StorefrontId } from "@/lib/shang-hai/storefronts";
import { PresentationBar } from "./PresentationBar";

/**
 * Common wrapper for the three storefronts: Spanish language scope, the MangoCat
 * presentation bar (outside the design) and the storefront's own cart. Everything
 * visual inside `children` belongs to the storefront.
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
    <div lang="es" className={className} data-storefront={storefront}>
      <PresentationBar current={storefront} />
      <CartProvider storefront={storefront}>{children}</CartProvider>
    </div>
  );
}

/** Shared copy so all three proposals word the demo notice identically. */
export const DEMO_NOTICE = "Demostración — no se realizará ningún cargo";
