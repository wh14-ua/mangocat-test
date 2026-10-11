import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Small uppercase tracked label above a heading. Rationed hard (max 1 per 3
 * sections per the design rules), so most sections omit it.
 */
export function Eyebrow({
  children,
  className,
  as: Tag = "p",
  tone = "ember",
}: {
  children: ReactNode;
  className?: string;
  as?: "p" | "span" | "div";
  tone?: "ember" | "mist";
}) {
  return (
    <Tag
      className={cn(
        "eyebrow",
        tone === "ember" ? "text-ember" : "text-mist",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
