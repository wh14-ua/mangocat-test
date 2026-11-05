import { formatCents } from "../commerce/money";
import { INTL_LOCALE, type Locale } from "./locale";

/** The restaurant's clock: every time shown to customers and staff is Madrid time. */
export const RESTAURANT_TIME_ZONE = "Europe/Madrid";

/** 1945 -> "19,45 €" (es) / "€19.45" (en). */
export function formatMoney(cents: number, locale: Locale): string {
  return formatCents(cents, INTL_LOCALE[locale]);
}

const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(locale: Locale, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let fmt = cache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: RESTAURANT_TIME_ZONE, ...options });
    cache.set(key, fmt);
  }
  return fmt;
}

/** "13:42" in Madrid time (24-hour clock in both languages, as on a kitchen ticket). */
export function formatClock(date: Date | string, locale: Locale): string {
  return formatter(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(date));
}

/** "5 de noviembre, 13:42" / "5 November, 13:42". */
export function formatDayAndTime(date: Date | string, locale: Locale): string {
  return formatter(locale, {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(date));
}

/** "8 piezas" / "8 pieces" (the catalog also uses "unidades"; English says pieces for both). */
export function formatPieces(count: number, unit: "piezas" | "unidades", locale: Locale): string {
  if (locale === "en") return `${count} ${count === 1 ? "piece" : "pieces"}`;
  if (count === 1) return unit === "piezas" ? "1 pieza" : "1 unidad";
  return `${count} ${unit}`;
}
