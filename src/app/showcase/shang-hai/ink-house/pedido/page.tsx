import type { Metadata } from "next";
import { InkHeader } from "@/components/shang-hai/ink-house/InkHeader";
import { InkCheckout } from "@/components/shang-hai/ink-house/InkCheckout";
import { InkFooter } from "@/components/shang-hai/ink-house/InkFooter";

export const metadata: Metadata = {
  title: { absolute: "Completa tu pedido · SHANG HAI — Propuesta 01 · Ink House" },
};

export default function InkCheckoutPage() {
  return (
    <>
      <InkHeader variant="compact" />
      <main id="contenido" className="ink-main">
        <InkCheckout />
      </main>
      <InkFooter />
    </>
  );
}
