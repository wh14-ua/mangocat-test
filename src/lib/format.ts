import { site } from "@/config";

/**
 * Locale-aware formatting helpers (WIG: use Intl, never hardcoded formats).
 */

const priceFormatter = new Intl.NumberFormat(site.locale, {
  style: "currency",
  currency: site.currency,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Format a price in major units, e.g. 185 -> "€185". */
export function formatPrice(amount: number): string {
  return priceFormatter.format(amount);
}

/** Format a Date as a long, locale-aware date, e.g. "Saturday, 14 March 2026". */
export function formatLongDate(date: Date, locale: string = site.locale): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** ISO yyyy-mm-dd in local time (safe for <input type="date"> values). */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}
