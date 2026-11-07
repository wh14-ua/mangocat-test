/**
 * Languages of the Shang Hai storefronts. Framework-agnostic: shared by the Next.js app,
 * the order engine and the Worker (Stripe Checkout locale, validation messages).
 */

export const LOCALES = ["es", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "es";

/** `?lang=en` forces a language (shareable links, Stripe return URLs). */
export const LOCALE_QUERY_PARAM = "lang";

/** Remembers the visitor's choice between pages and visits (never anything personal). */
export const LOCALE_STORAGE_KEY = "mangocat:shang-hai:locale:v1";

/** BCP 47 tags for Intl formatting. British English: the coast's English speakers are mostly British. */
export const INTL_LOCALE: Record<Locale, string> = { es: "es-ES", en: "en-GB" };

export const LOCALE_NAMES: Record<Locale, { short: string; name: string }> = {
  es: { short: "ES", name: "Español" },
  en: { short: "EN", name: "English" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Accepts "es", "EN", "es-ES", "en-GB"…; anything else is null. */
export function parseLocale(value: unknown): Locale | null {
  if (typeof value !== "string") return null;
  const base = value.trim().toLowerCase().split(/[-_]/)[0];
  return isLocale(base) ? base : null;
}

/** One dictionary per language with the same shape (the type checker enforces parity). */
export type Messages<T> = { readonly es: T; readonly en: T };

export function defineMessages<T>(messages: { es: T; en: NoInfer<T> }): Messages<T> {
  return messages;
}
