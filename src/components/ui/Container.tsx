import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Centered content column with responsive gutters. */
export function Container({
  children,
  className,
  wide = false,
}: {
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 sm:px-8 lg:px-10",
        wide ? "max-w-[1440px]" : "max-w-[1280px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
