"use client";

import { useEffect } from "react";
import { useLocale } from "@/hooks/shang-hai/useLocale";
import { INK_TEXT } from "@/lib/shang-hai/i18n/ink-house";

type InkPageId = keyof (typeof INK_TEXT)["es"]["meta"];

/**
 * The static export ships the Spanish <title> (route metadata, from the same dictionary);
 * this keeps the browser tab in the visitor's language once the page has rendered.
 */
export function InkDocumentTitle({ page }: { page: InkPageId }) {
  const { locale } = useLocale();
  useEffect(() => {
    document.title = INK_TEXT[locale].meta[page];
  }, [locale, page]);
  return null;
}

export function InkSkipLink() {
  const { locale } = useLocale();
  return (
    <a href="#carta" className="ink-skip">
      {INK_TEXT[locale].skipToMenu}
    </a>
  );
}
