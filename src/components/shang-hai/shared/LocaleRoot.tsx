"use client";

import { LocaleSync, useLocale } from "@/hooks/shang-hai/useLocale";

/**
 * The language scope of a Shang Hai page: `lang` follows the visitor's choice and
 * `data-sh-i18n` lets LocaleBootScript keep it hidden until the right language renders.
 */
export function LocaleRoot({
  className,
  children,
  ...rest
}: {
  className?: string;
  children: React.ReactNode;
} & Record<`data-${string}`, string>) {
  const { locale } = useLocale();
  return (
    <div lang={locale} className={className} data-sh-i18n="" {...rest}>
      <LocaleSync />
      {children}
    </div>
  );
}
