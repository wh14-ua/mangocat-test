import type { Metadata } from "next";
import { Suspense } from "react";
import { InkHeader } from "@/components/shang-hai/ink-house/InkHeader";
import { InkStatus, InkStatusSkeleton } from "@/components/shang-hai/ink-house/InkStatus";
import { InkFooter } from "@/components/shang-hai/ink-house/InkFooter";
import { InkDocumentTitle } from "@/components/shang-hai/ink-house/InkPage";
import { INK_TEXT } from "@/lib/shang-hai/i18n/ink-house";

export const metadata: Metadata = {
  title: { absolute: INK_TEXT.es.meta.status },
};

export default function InkStatusPage() {
  return (
    <>
      <InkDocumentTitle page="status" />
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
