import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutView } from "@/components/shang-hai/wok-after-dark/Checkout";

export const metadata: Metadata = {
  title: { absolute: "Pagar y recoger · SHANG HAI — Propuesta 02 · Wok After Dark" },
};

export default function WokCheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh]" />}>
      <CheckoutView />
    </Suspense>
  );
}
