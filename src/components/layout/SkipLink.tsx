/** Keyboard skip link to the main landmark (WIG). Visible only on focus. */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only z-[120] focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:inline-flex focus:items-center focus:bg-ember focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:uppercase focus:tracking-[0.12em] focus:text-on-ember"
    >
      Skip to content
    </a>
  );
}
