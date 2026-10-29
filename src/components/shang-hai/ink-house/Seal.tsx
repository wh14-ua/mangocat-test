import { SEAL_GLYPHS } from "./seal-glyphs";

/**
 * The INK HOUSE mark: 上海 (the restaurant's name) reversed out of a lacquer-red seal.
 * The rough edge and the paper speckle come from the shared `#ink-seal-press` filter
 * declared once by <InkDefs/>. Decorative by default; pass `label` to expose it.
 */
export function Seal({
  className,
  label,
  tone = "lacquer",
}: {
  className?: string;
  label?: string;
  tone?: "lacquer" | "ink";
}) {
  return (
    <svg
      viewBox="0 0 220 420"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <g filter="url(#ink-seal-press)">
        <rect
          x="6"
          y="6"
          width="208"
          height="408"
          rx="14"
          fill={tone === "lacquer" ? "var(--ink-lacquer)" : "var(--ink-ink)"}
        />
        <g fill="var(--ink-paper)">
          <path transform="translate(26 26) scale(0.168)" d={SEAL_GLYPHS.shang} />
          <path transform="translate(26 222) scale(0.168)" d={SEAL_GLYPHS.hai} />
        </g>
      </g>
    </svg>
  );
}

/** Shared SVG filter definitions (rendered once per page by the layout). */
export function InkDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute" }}>
      <defs>
        <filter id="ink-seal-press" x="-6%" y="-6%" width="112%" height="112%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="11" result="warp" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="warp"
            scale="5"
            xChannelSelector="R"
            yChannelSelector="G"
            result="rough"
          />
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="1" seed="4" result="grain" />
          <feColorMatrix
            in="grain"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2.6 0 0 0 2.05"
            result="speckle"
          />
          <feComposite in="rough" in2="speckle" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}
