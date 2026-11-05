"use client";

import { useLocale } from "@/hooks/shang-hai/useLocale";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n/locale";

/**
 * Accessible "ES | EN" language switch with no visual opinion: each storefront styles it
 * in its own identity through the class names and the data attributes it exposes
 * (`data-locale` on every button, `data-active="true"` on the current one).
 *
 * Every button is a real toggle (aria-pressed), labelled in its own language so a screen
 * reader pronounces "English" correctly even on the Spanish page.
 */
export function LanguageSwitch({
  className,
  buttonClassName,
  separator,
  separatorClassName,
  label = "Idioma · Language",
  onChange,
}: {
  className?: string;
  buttonClassName?: string;
  /** Optional decorative separator between the two codes, e.g. "|" or "/". */
  separator?: React.ReactNode;
  separatorClassName?: string;
  /** Accessible name of the group (bilingual by default). */
  label?: string;
  onChange?: (locale: Locale) => void;
}) {
  const { locale, setLocale } = useLocale();
  return (
    <div role="group" aria-label={label} className={className} data-testid="language-switch" data-locale={locale}>
      {LOCALES.map((code, i) => {
        const active = code === locale;
        return (
          <span key={code} style={{ display: "contents" }}>
            {i > 0 && separator !== undefined && (
              <span aria-hidden="true" className={separatorClassName}>
                {separator}
              </span>
            )}
            <button
              type="button"
              lang={code}
              className={buttonClassName}
              aria-pressed={active}
              aria-label={LOCALE_NAMES[code].name}
              data-locale={code}
              data-active={active ? "true" : undefined}
              data-testid={`language-${code}`}
              onClick={() => {
                if (!active) {
                  setLocale(code);
                  onChange?.(code);
                }
              }}
            >
              {LOCALE_NAMES[code].short}
            </button>
          </span>
        );
      })}
    </div>
  );
}
