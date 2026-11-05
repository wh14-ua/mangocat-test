import type { Metadata } from "next";
import { Suspense } from "react";
import { DemoPaymentScreen } from "@/components/shang-hai/shared/DemoPaymentScreen";
import { LocaleBootScript } from "@/components/shang-hai/shared/LocaleBoot";
import { LocaleRoot } from "@/components/shang-hai/shared/LocaleRoot";

export const metadata: Metadata = {
  title: { absolute: "Simulador de pago · Demostración · SHANG HAI" },
};

export default function DemoPaymentPage() {
  return (
    <>
      <LocaleBootScript />
      <LocaleRoot>
        <Suspense fallback={<div className="min-h-[100dvh] bg-[#eceef1]" />}>
          <DemoPaymentScreen />
        </Suspense>
      </LocaleRoot>
    </>
  );
}
