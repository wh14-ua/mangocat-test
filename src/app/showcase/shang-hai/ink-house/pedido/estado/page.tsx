import type { Metadata } from "next";
import { Suspense } from "react";
import { InkHeader } from "@/components/shang-hai/ink-house/InkHeader";
import { InkStatus, InkStatusSkeleton } from "@/components/shang-hai/ink-house/InkStatus";
import { InkFooter } from "@/components/shang-hai/ink-house/InkFooter";

export const metadata: Metadata = {
  title: { absolute: "Estado del pedido · SHANG HAI — Propuesta 01 · Ink House" },
};

export default function InkStatusPage() {
  return (
    <>
      <InkHeader variant="compact" />
      <main id="contenido" className="ink-main">
        <Suspense fallback={<InkStatusSkeleton />}>
          <InkStatus />
        </Suspense>
      </main>
      <InkFooter />
    </>
  );
}
