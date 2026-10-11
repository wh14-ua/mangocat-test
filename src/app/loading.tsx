import { site } from "@/config";

export default function Loading() {
  return (
    <div
      className="flex min-h-[70dvh] items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <span className="animate-pulse font-display text-2xl tracking-[0.24em] text-ash">
        {site.wordmark}
      </span>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
