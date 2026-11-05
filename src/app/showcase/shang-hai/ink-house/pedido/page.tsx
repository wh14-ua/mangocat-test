import type { Metadata } from "next";
import { InkHeader } from "@/components/shang-hai/ink-house/InkHeader";
import { InkCheckout } from "@/components/shang-hai/ink-house/InkCheckout";
import { InkFooter } from "@/components/shang-hai/ink-house/InkFooter";
import { InkDocumentTitle } from "@/components/shang-hai/ink-house/InkPage";
import { INK_TEXT } from "@/lib/shang-hai/i18n/ink-house";

export const metadata: Metadata = {
  title: { absolute: INK_TEXT.es.meta.checkout },
};

export default function InkCheckoutPage() {
  return (
    <>
      <InkDocumentTitle page="checkout" />
      <InkHeader variant="compact" />
      <main id="contenido" className="ink-main">
        <InkCheckout />
      </main>
      <InkFooter />
    </>
  );
}
