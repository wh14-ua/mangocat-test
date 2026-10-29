import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutView } from "@/components/shang-hai/bento-club/CheckoutView";

export const metadata: Metadata = {
  title: { absolute: "Tu pedido · SHANG HAI — Propuesta 03 · Bento Club" },
};

export default function BentoClubCheckoutPage() {
  return (
    <Suspense fallback={<div className="bc-co" aria-busy="true" />}>
      <CheckoutView />
    </Suspense>
  );
}
