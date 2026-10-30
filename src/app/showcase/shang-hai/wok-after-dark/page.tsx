import { WokCartActionsProvider } from "@/components/shang-hai/wok-after-dark/cart-actions";
import { WokUIProvider } from "@/components/shang-hai/wok-after-dark/WokUI";
import { MenuDrawer, SideRail, TopBar } from "@/components/shang-hai/wok-after-dark/Navigation";
import { Carta } from "@/components/shang-hai/wok-after-dark/Carta";
import { CartDock, CartTicket } from "@/components/shang-hai/wok-after-dark/CartTicket";
import { OptionChooser } from "@/components/shang-hai/wok-after-dark/OptionChooser";
import { CartAnnouncer, ScrollProgress } from "@/components/shang-hai/wok-after-dark/Ambient";
import { Footer, Hero, Info } from "@/components/shang-hai/wok-after-dark/Poster";

export default function WokAfterDarkHome() {
  return (
    <WokUIProvider>
      <WokCartActionsProvider>
        <ScrollProgress />
        <div className="wok-frame lg:flex">
          <SideRail />
          <div className="min-w-0 flex-1">
            <TopBar />
            <main id="contenido">
              <Hero />
              <Carta />
              <Info />
            </main>
            <Footer />
          </div>
        </div>
        <CartDock />
        <CartTicket />
        <OptionChooser />
        <MenuDrawer />
        <CartAnnouncer />
      </WokCartActionsProvider>
    </WokUIProvider>
  );
}
