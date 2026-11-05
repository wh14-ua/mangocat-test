"use client";

import { useEffect } from "react";
import { LanguageSwitch } from "@/components/shang-hai/shared/LanguageSwitch";
import { useMessages } from "@/hooks/shang-hai/useLocale";
import { COMMON_TEXT } from "@/lib/shang-hai/i18n/common";
import { WOK_TEXT } from "@/lib/shang-hai/i18n/wok-after-dark";

/** Wok After Dark copy in the visitor's language. */
export function useWokText() {
  return useMessages(WOK_TEXT);
}

/**
 * ES | EN in the poster idiom: condensed caps, the active code stamped on an orange block
 * (like the SH mark), the other one in metal, a hairline between them. Each code is a
 * 44 px target. "bar" sits in the top bars, "rail" stacks the codes in the desktop rail.
 */
export function WokLanguageSwitch({
  variant = "bar",
  className = "",
}: {
  variant?: "bar" | "rail";
  className?: string;
}) {
  const common = useMessages(COMMON_TEXT);
  return (
    <LanguageSwitch
      label={common.language.groupLabel}
      className={`wok-lang wok-lang--${variant} ${className}`}
      buttonClassName="wok-lang-btn"
      separator=""
      separatorClassName="wok-lang-sep"
    />
  );
}

/**
 * The static export ships Spanish <title>s; this keeps the tab title (also what the route
 * announcer reads on client navigation) in the visitor's language.
 */
export function useWokDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
