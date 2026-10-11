import type { ThemeConfig } from "./types";

/**
 * JS mirror of the design tokens defined in src/app/globals.css (@theme block).
 * The CSS block is the canonical source for styling; this file exists for the
 * few JS consumers that need a token value (e.g. the <meta name="theme-color">
 * and structured data). Keep the two in sync when re-skinning. See DESIGN.md §2.
 */
export const theme: ThemeConfig = {
  colors: {
    noir: "#0c0c0d",
    coal: "#141416",
    onyx: "#1b1c1f",
    graphite: "#272829",
    porcelain: "#f3f2ee",
    mist: "#a7a8a3",
    ash: "#80817c",
    ember: "#e4a54c",
    emberDeep: "#c98a39",
    onEmber: "#0c0c0d",
    positive: "#86be8e",
    critical: "#e3756a",
  },
  fonts: {
    display: "Cormorant Garamond",
    sans: "Hanken Grotesk",
  },
  themeColor: "#0c0c0d",
};
