import { InkHeader } from "@/components/shang-hai/ink-house/InkHeader";
import { InkHero } from "@/components/shang-hai/ink-house/InkHero";
import { InkCarta } from "@/components/shang-hai/ink-house/InkCarta";
import { InkInfo } from "@/components/shang-hai/ink-house/InkInfo";
import { InkFooter } from "@/components/shang-hai/ink-house/InkFooter";

export default function InkHousePage() {
  return (
    <>
      <a href="#carta" className="ink-skip">
        Saltar a la carta
      </a>
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
