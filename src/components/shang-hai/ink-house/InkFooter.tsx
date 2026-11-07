"use client";

import Link from "next/link";
import { shangHaiRestaurant } from "@/data/shang-hai/restaurant";
import { useLocale } from "@/hooks/shang-hai/useLocale";
import { COMMON_TEXT } from "@/lib/shang-hai/i18n/common";
import { INK_TEXT } from "@/lib/shang-hai/i18n/ink-house";
import { SHANG_HAI_CREDITS_PATH } from "@/lib/shang-hai/storefronts";
import { Seal } from "./Seal";

const address = shangHaiRestaurant.address.value;

/** Colophon, as on the last page of a printed book. */
export function InkFooter() {
  const { locale } = useLocale();
  const t = INK_TEXT[locale].footer;
  return (
    <footer className="ink-footer">
      <div className="ink-footer__inner">
        <Seal className="ink-footer__seal" />
        <div>
          <p className="ink-footer__brand">{shangHaiRestaurant.brand.name}</p>
          <p className="ink-footer__line">{COMMON_TEXT[locale].brand.descriptor}</p>
          <p className="ink-footer__line">
            {address.street}, {address.postalCode} {address.city} ({address.province})
          </p>
        </div>
        <p className="ink-footer__meta">
          <Link href={SHANG_HAI_CREDITS_PATH} className="ink-link">
            {t.credits}
          </Link>
          <span className="ink-footer__credit">{t.byline}</span>
        </p>
      </div>
    </footer>
  );
}
