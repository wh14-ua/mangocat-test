import Link from "next/link";
import { shangHaiRestaurant } from "@/data/shang-hai/restaurant";
import { SHANG_HAI_CREDITS_PATH } from "@/lib/shang-hai/storefronts";
import { Seal } from "./Seal";

const address = shangHaiRestaurant.address.value;

/** Colophon, as on the last page of a printed book. */
export function InkFooter() {
  return (
    <footer className="ink-footer">
      <div className="ink-footer__inner">
        <Seal className="ink-footer__seal" />
        <div>
          <p className="ink-footer__brand">{shangHaiRestaurant.brand.name}</p>
          <p className="ink-footer__line">{shangHaiRestaurant.brand.descriptor}</p>
          <p className="ink-footer__line">
            {address.street}, {address.postalCode} {address.city} ({address.province})
          </p>
        </div>
        <p className="ink-footer__meta">
          <Link href={SHANG_HAI_CREDITS_PATH} className="ink-link">
            Créditos fotográficos
          </Link>
          <span className="ink-footer__credit">Una propuesta de MangoCat Studios</span>
        </p>
      </div>
    </footer>
  );
}
