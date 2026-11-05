import { InkHeader } from "@/components/shang-hai/ink-house/InkHeader";
import { InkHero } from "@/components/shang-hai/ink-house/InkHero";
import { InkCarta } from "@/components/shang-hai/ink-house/InkCarta";
import { InkInfo } from "@/components/shang-hai/ink-house/InkInfo";
import { InkFooter } from "@/components/shang-hai/ink-house/InkFooter";
import { InkDocumentTitle, InkSkipLink } from "@/components/shang-hai/ink-house/InkPage";

export default function InkHousePage() {
  return (
    <>
      <InkDocumentTitle page="home" />
      <InkSkipLink />
      <InkHeader />
      <main id="contenido" className="ink-main">
        <InkHero />
        <InkCarta />
        <InkInfo />
      </main>
      <InkFooter />
    </>
  );
}
