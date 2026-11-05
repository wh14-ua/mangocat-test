import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutView } from "@/components/shang-hai/bento-club/CheckoutView";
import { BENTO_TEXT } from "@/lib/shang-hai/i18n/bento-club";

export const metadata: Metadata = {
  title: { absolute: BENTO_TEXT.es.meta.checkout },
};

export default function BentoClubCheckoutPage() {
  return (
    <Suspense fallback={<div className="bc-co" aria-busy="true" />}>
      <CheckoutView />
    </Suspense>
  );
}
