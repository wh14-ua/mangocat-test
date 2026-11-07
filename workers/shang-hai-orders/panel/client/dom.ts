/**
 * Tiny DOM toolkit. Every piece of order data reaches the page as a text node or an
 * attribute value set through the DOM API; nothing is ever parsed as HTML.
 */
import { SEAL_GLYPHS, SEAL_GLYPH_TRANSFORMS, SEAL_RECT, SEAL_VIEWBOX } from "../shared/brand";
import { ICONS, type IconName } from "./icons";

export type Child = Node | string | number | null | undefined | false;
type AttrValue = string | number | boolean | null | undefined;
type Handlers = { [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void };

export type Props = {
  class?: string;
  text?: string;
  attrs?: Record<string, AttrValue>;
  on?: Handlers;
};

function setAttr(el: Element, name: string, value: AttrValue): void {
  // Inline styles and inline handlers are blocked by the CSP anyway; refuse them early.
  if (name === "style" || name.toLowerCase().startsWith("on")) throw new Error(`Refused attribute ${name}`);
  if (value === null || value === undefined || value === false) return;
  el.setAttribute(name, value === true ? "" : String(value));
}

export function append(parent: Node, children: readonly Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(typeof child === "string" || typeof child === "number" ? document.createTextNode(String(child)) : child);
  }
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | string | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (typeof props === "string") {
    el.className = props;
  } else if (props) {
    if (props.class) el.className = props.class;
    if (props.attrs) for (const [name, value] of Object.entries(props.attrs)) setAttr(el, name, value);
    if (props.on) {
      for (const [type, handler] of Object.entries(props.on)) el.addEventListener(type, handler as EventListener);
    }
    if (props.text !== undefined) el.textContent = props.text;
  }
  append(el, children);
  return el;
}

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  return el;
}

/** A decorative line icon (24×24, currentColor). */
export function icon(name: IconName, className = "ico"): SVGSVGElement {
  const svg = svgEl("svg", {
    class: className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
    focusable: "false",
  });
  for (const d of ICONS[name]) svg.appendChild(svgEl("path", { d }));
  return svg;
}

/** The 上海 seal (decorative: the brand name is always written next to it). */
export function seal(className = "seal"): SVGSVGElement {
  const svg = svgEl("svg", { class: className, viewBox: SEAL_VIEWBOX, "aria-hidden": "true", focusable: "false" });
  svg.appendChild(
    svgEl("rect", {
      class: "seal__bg",
      x: String(SEAL_RECT.x),
      y: String(SEAL_RECT.y),
      width: String(SEAL_RECT.width),
      height: String(SEAL_RECT.height),
      rx: String(SEAL_RECT.rx),
    }),
  );
  const glyphs = svgEl("g", { class: "seal__glyphs" });
  glyphs.appendChild(svgEl("path", { transform: SEAL_GLYPH_TRANSFORMS.shang, d: SEAL_GLYPHS.shang }));
  glyphs.appendChild(svgEl("path", { transform: SEAL_GLYPH_TRANSFORMS.hai, d: SEAL_GLYPHS.hai }));
  svg.appendChild(glyphs);
  return svg;
}

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
}

/** Moves focus without scrolling the page when the browser supports it. */
export function focusQuietly(el: HTMLElement | null | undefined): void {
  if (!el) return;
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
}
