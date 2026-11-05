"use client";

import { LanguageSwitch } from "@/components/shang-hai/shared/LanguageSwitch";
import { COMMON_TEXT } from "@/lib/shang-hai/i18n/common";
import { useLocale } from "@/hooks/shang-hai/useLocale";

/**
 * ES | EN set like a running head: small spaced capitals in stone, the current language in
 * ink with a short lacquer rule under it, the two codes parted by a hairline. Each code is
 * a full 44 × 44 px target.
 */
export function InkLanguageSwitch({ className }: { className?: string }) {
  const { locale } = useLocale();
  return (
    <LanguageSwitch
      className={className ? `ink-lang ${className}` : "ink-lang"}
      buttonClassName="ink-lang__btn"
      separator=""
      separatorClassName="ink-lang__rule"
      label={COMMON_TEXT[locale].language.groupLabel}
    />
  );
}
