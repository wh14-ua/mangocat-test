import type { Metadata } from "next";
import { Suspense } from "react";
import { DemoPaymentScreen } from "@/components/shang-hai/shared/DemoPaymentScreen";

export const metadata: Metadata = {
  title: { absolute: "Simulador de pago · Demostración · SHANG HAI" },
};

export default function DemoPaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-[#eceef1]" />}>
      <DemoPaymentScreen />
    </Suspense>
  );
}
