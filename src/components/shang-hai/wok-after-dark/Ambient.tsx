"use client";

import { motion, useScroll } from "motion/react";
import { formatMoney } from "@/lib/i18n/format";
import { useCart } from "@/hooks/shang-hai/useCart";
import { useLocale } from "@/hooks/shang-hai/useLocale";
import { shangHaiCatalog } from "@/lib/shang-hai/catalog";
import { itemName } from "@/lib/shang-hai/menu-i18n";
import { useWokText } from "./WokLanguage";

/** Thin orange bar that tracks how far down the poster you are. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  return <motion.div aria-hidden className="wok-progress" style={{ scaleX: scrollYProgress }} />;
}

/** Screen-reader announcements for cart changes (derived, no extra state). */
export function CartAnnouncer() {
  const { lastEvent, itemCount, totalCents } = useCart();
  const { locale } = useLocale();
  const t = useWokText();
  let message = "";
  if (lastEvent?.type === "added") {
    const item = shangHaiCatalog.byId.get(lastEvent.itemId);
    const name = item ? itemName(item, locale) : t.announce.dishFallback;
    message = t.announce.added(name, itemCount, formatMoney(totalCents, locale));
  } else if (lastEvent?.type === "rejected") {
    message =
      lastEvent.error === "quantity-limit" || lastEvent.error === "order-limit"
        ? t.announce.limit
        : t.announce.unavailable;
  } else if (lastEvent?.type === "removed") {
    message = t.announce.removed(itemCount);
  }
  return (
    <p aria-live="polite" className="wok-sr">
      {message}
    </p>
  );
}
