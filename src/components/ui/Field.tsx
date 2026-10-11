import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Shared input chrome (sharp, dark-native). Focus shows the global ember ring. */
export const inputBase =
  "h-12 w-full border border-line bg-onyx px-4 font-sans text-sm text-porcelain transition-colors duration-200 placeholder:text-ash hover:border-line-strong focus:border-ember";

/** Label-above field wrapper with optional hint and inline error (WIG-compliant). */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label
        htmlFor={htmlFor}
        className="font-sans text-xs font-medium uppercase tracking-[0.12em] text-mist"
      >
        {label}
        {required && (
          <span className="text-ember" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      {children}
      {hint && (
        <p id={`${htmlFor}-hint`} className="font-sans text-xs text-ash">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${htmlFor}-error`}
          role="alert"
          className="font-sans text-xs text-critical"
        >
          {error}
        </p>
      )}
    </div>
  );
}
