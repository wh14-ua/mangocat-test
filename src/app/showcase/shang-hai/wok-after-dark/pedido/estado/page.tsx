import type { Metadata } from "next";
import { Suspense } from "react";
import { StatusView } from "@/components/shang-hai/wok-after-dark/Status";

export const metadata: Metadata = {
  title: { absolute: "Estado del pedido · SHANG HAI — Propuesta 02 · Wok After Dark" },
};

export default function WokStatusPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh]" />}>
      <StatusView />
    </Suspense>
  );
}
