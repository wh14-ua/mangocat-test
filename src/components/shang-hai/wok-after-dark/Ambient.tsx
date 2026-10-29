"use client";

import { motion, useScroll } from "motion/react";
import { formatCents } from "@/lib/commerce/money";
import { useCart } from "@/hooks/shang-hai/useCart";
import { shangHaiCatalog } from "@/lib/shang-hai/catalog";

/** Thin orange bar that tracks how far down the poster you are. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  return <motion.div aria-hidden className="wok-progress" style={{ scaleX: scrollYProgress }} />;
}

/** Screen-reader announcements for cart changes (derived, no extra state). */
export function CartAnnouncer() {
  const { lastEvent, itemCount, totalCents } = useCart();
  let message = "";
  if (lastEvent?.type === "added") {
    const name = shangHaiCatalog.byId.get(lastEvent.itemId)?.name ?? "plato";
    message = `Añadido: ${name}. Tu ticket: ${itemCount} ${itemCount === 1 ? "producto" : "productos"}, ${formatCents(totalCents)}.`;
  } else if (lastEvent?.type === "rejected") {
    message =
      lastEvent.error === "quantity-limit" || lastEvent.error === "order-limit"
        ? "Has llegado al máximo de unidades para un pedido online."
        : "Este plato no se puede añadir ahora mismo.";
  } else if (lastEvent?.type === "removed") {
    message = `Plato quitado. Tu ticket: ${itemCount} ${itemCount === 1 ? "producto" : "productos"}.`;
  }
  return (
    <p aria-live="polite" className="wok-sr">
      {message}
    </p>
  );
}
