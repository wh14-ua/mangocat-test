"use client";

import { usePathname } from "next/navigation";
import { SkipLink } from "./SkipLink";
import { Nav } from "./Nav";
import { Footer } from "./Footer";
import { StructuredData } from "./StructuredData";
import { ModeSwitch } from "./ModeSwitch";

/**
 * Chooses the page chrome by route.
 *
 * ATELIER routes keep their nav, footer, skip link and restaurant JSON-LD. The Design
 * Showcase (/showcase and the six demos) renders bare: each demo is an independent,
 * fully art-directed page that brings its own header and footer, so it must not inherit
 * ATELIER's chrome.
 *
 * Both worlds also get the `ModeSwitch`, a persistent floating control that lets a
 * visitor switch between the flagship ATELIER site and the Showcase catalog, making the
 * dual nature of the project obvious from any page.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isShowcase = pathname === "/showcase" || pathname?.startsWith("/showcase/");

  if (isShowcase)
    return (
      <>
        {children}
        <ModeSwitch />
      </>
    );

  return (
    <>
      <SkipLink />
      <Nav />
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <Footer />
      <StructuredData />
      <ModeSwitch />
    </>
  );
}
