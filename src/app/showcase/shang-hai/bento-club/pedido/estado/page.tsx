import type { Metadata } from "next";
import { Suspense } from "react";
import { StatusView } from "@/components/shang-hai/bento-club/StatusView";

export const metadata: Metadata = {
  title: { absolute: "Estado del pedido · SHANG HAI — Propuesta 03 · Bento Club" },
};

export default function BentoClubStatusPage() {
  return (
    <Suspense fallback={<div className="bc-st" aria-busy="true" />}>
      <StatusView />
    </Suspense>
  );
}
