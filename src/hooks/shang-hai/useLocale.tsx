"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_QUERY_PARAM,
  LOCALE_STORAGE_KEY,
  parseLocale,
  type Locale,
  type Messages,
} from "@/lib/i18n/locale";

/**
 * The storefronts' language, shared by every Shang Hai page in the browser.
 *
 * Priority on first read: ?lang= in the URL (shareable links, Stripe return URLs) > the
 * visitor's saved choice > the browser's preferred language (es/en) > Spanish. Choosing a
 * language saves it, keeps it while navigating and syncs other tabs. The cart lives in a
 * different store, so switching language never touches it.
 *
 * The static HTML is Spanish; LocaleBootScript applies the saved language before the first
 * paint so English visitors do not see a flash of Spanish.
 */

let current: Locale | null = null;
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function detectFromBrowser(): Locale | null {
  if (typeof navigator === "undefined") return null;
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of preferred) {
    const locale = parseLocale(tag);
    if (locale) return locale;
  }
  return null;
}

function readInitial(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const fromUrl = parseLocale(new URLSearchParams(window.location.search).get(LOCALE_QUERY_PARAM));
  if (fromUrl) {
    try {
      storage()?.setItem(LOCALE_STORAGE_KEY, fromUrl);
    } catch {
      /* private mode: the URL still decides */
    }
    return fromUrl;
  }
  let saved: Locale | null = null;
  try {
    saved = parseLocale(storage()?.getItem(LOCALE_STORAGE_KEY));
  } catch {
    saved = null;
  }
  return saved ?? detectFromBrowser() ?? DEFAULT_LOCALE;
}

function getSnapshot(): Locale {
  if (current === null) current = readInitial();
  return current;
}

function getServerSnapshot(): Locale {
  return DEFAULT_LOCALE;
}

function emit() {
  listeners.forEach((l) => l());
}

function onStorage(event: StorageEvent) {
  if (event.key !== LOCALE_STORAGE_KEY) return;
  const next = parseLocale(event.newValue);
  if (next && next !== current) {
    current = next;
    emit();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

export function setLocale(locale: Locale) {
  current = locale;
  try {
    storage()?.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* the choice still applies to this page */
  }
  if (typeof window !== "undefined") {
    // A ?lang= left in the address bar would override the new choice on reload.
    const url = new URL(window.location.href);
    if (url.searchParams.has(LOCALE_QUERY_PARAM)) {
      url.searchParams.set(LOCALE_QUERY_PARAM, locale);
      window.history.replaceState(window.history.state, "", url);
    }
    document.documentElement.lang = locale;
  }
  emit();
}

export function useLocale(): { locale: Locale; setLocale: (locale: Locale) => void } {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { locale, setLocale };
}

/** Picks the dictionary of the current language: `const t = useMessages(SHOP_TEXT)`. */
export function useMessages<T>(messages: Messages<T>): T {
  return messages[useLocale().locale];
}

/**
 * Keeps <html lang> in sync and lifts the pre-paint guard set by LocaleBootScript once
 * React has rendered the right language.
 */
export function LocaleSync() {
  const { locale } = useLocale();
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.removeAttribute("data-sh-locale-pending");
  }, [locale]);
  return null;
}

/** For tests: forget the in-memory choice so the next read starts over. */
export function resetLocaleForTests() {
  current = null;
}
