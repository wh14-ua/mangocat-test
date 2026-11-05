/**
 * Brand data shared by the Worker-side shell (server.ts) and the browser client.
 * Pure data only: this file is type-checked both with Workers types and with DOM types.
 */

export const APP_NAME = "SHANG HAI — PEDIDOS";
export const APP_SHORT_NAME = "Pedidos";

/** Lacquer red of the 上海 seal (the restaurant's mark). */
export const LACQUER = "#A7342F";

/** Colours the browser chrome uses before and around the panel (meta theme-color, manifest). */
export const THEME = {
  light: { bar: "#FFFFFF", page: "#E6E9ED" },
  dark: { bar: "#1A1F25", page: "#0F1216" },
} as const;

/**
 * Outlines of 上海 ("Shanghai"), the restaurant's name, for the seal mark. Extracted from
 * Noto Serif CJK SC Black (SIL Open Font License 1.1, https://github.com/notofonts/noto-cjk),
 * the same outlines the INK HOUSE storefront uses, so the mark renders identically on every
 * phone without loading a font (the panel's CSP allows no web fonts).
 * Coordinates: 1000-unit em box, y down.
 */
export const SEAL_GLYPHS = {
  shang:
    "M25 893 33 921H947C962 921 974 916 977 905C920 857 826 786 826 786L742 893H546V455H876C891 455 902 450 905 439C850 391 758 321 758 321L676 427H546V88C574 84 581 74 583 59L386 41V893Z",
  hai: "M534 570 525 575C551 610 575 666 576 715C669 791 775 611 534 570ZM543 350 534 355C557 389 585 442 592 488C683 555 776 384 543 350ZM85 663C74 663 40 663 40 663V681C62 683 79 688 93 698C117 714 121 817 100 923C110 964 138 976 163 976C218 976 256 939 257 886C260 792 214 759 212 701C211 674 218 636 225 600C236 541 291 307 324 180L309 176C137 603 137 603 116 642C105 663 101 663 85 663ZM26 270 19 275C45 311 73 366 79 418C193 500 308 287 26 270ZM99 36 92 41C119 82 149 141 157 198C278 286 399 60 99 36ZM845 62 777 156H521C535 134 547 112 558 90C584 93 592 88 596 77L412 27C391 155 337 313 272 402L280 409C314 388 345 364 375 336C369 396 361 462 352 526H254L262 554H349C339 627 328 695 317 745C305 752 293 761 285 769L407 836L452 778H710C702 808 694 827 684 836C675 844 665 848 650 848C630 848 589 846 561 844V856C597 866 617 877 631 897C643 914 645 940 645 975C703 975 750 967 786 932C814 905 833 863 846 778H947C960 778 970 773 973 762C944 726 889 669 889 669L851 734C856 686 861 627 864 554H962C976 554 986 549 988 538C959 499 901 438 901 438L866 498L871 337C894 333 908 326 916 317L802 216L732 286H541L459 246C475 226 490 205 504 184H939C953 184 964 179 967 168C922 125 845 62 845 62ZM715 750H449C459 696 469 625 480 554H734C729 640 723 705 715 750ZM736 526H484C495 447 505 370 511 314H743C741 395 739 466 736 526Z",
} as const;

/** The seal as SVG geometry: a lacquer rectangle with the two glyphs stacked. */
export const SEAL_VIEWBOX = "0 0 220 420";
export const SEAL_RECT = { x: 6, y: 6, width: 208, height: 408, rx: 14 } as const;
export const SEAL_GLYPH_TRANSFORMS = { shang: "translate(26 26) scale(0.168)", hai: "translate(26 222) scale(0.168)" } as const;
