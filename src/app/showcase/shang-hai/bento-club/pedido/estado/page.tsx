import type { Metadata } from "next";
import { Suspense } from "react";
import { StatusView } from "@/components/shang-hai/bento-club/StatusView";
import { BENTO_TEXT } from "@/lib/shang-hai/i18n/bento-club";

export const metadata: Metadata = {
  title: { absolute: BENTO_TEXT.es.meta.status },
};

export default function BentoClubStatusPage() {
  return (
    <Suspense fallback={<div className="bc-st" aria-busy="true" />}>
      <StatusView />
    </Suspense>
  );
}
