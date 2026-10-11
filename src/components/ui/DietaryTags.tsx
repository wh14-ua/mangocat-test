import { menu } from "@/config";
import type { DietaryCode } from "@/config";
import { cn } from "@/lib/cn";

const labelMap: Record<string, string> = Object.fromEntries(
  menu.legend.map((l) => [l.code, l.label]),
);

/**
 * Compact dietary markers. Letters are visual; a screen-reader-only phrase spells
 * out the full meaning, and each abbr carries a title for pointer users.
 */
export function DietaryTags({
  tags,
  className,
}: {
  tags?: DietaryCode[];
  className?: string;
}) {
  if (!tags || tags.length === 0) return null;
  return (
    <span className={cn("inline-flex items-center gap-x-1.5 align-middle", className)}>
      <span className="sr-only">
        Dietary: {tags.map((t) => labelMap[t]).join(", ")}
      </span>
      {tags.map((t) => (
        <abbr
          key={t}
          title={labelMap[t]}
          aria-hidden="true"
          className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-ember/75 no-underline"
        >
          {t}
        </abbr>
      ))}
    </span>
  );
}
