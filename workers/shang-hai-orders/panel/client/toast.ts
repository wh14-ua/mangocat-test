/** Short messages at the bottom of the screen, announced to screen readers. */
import { h, icon } from "./dom";
import type { IconName } from "./icons";

export type ToastTone = "ok" | "info" | "warn" | "error";

const ICON: Record<ToastTone, IconName> = { ok: "check", info: "info", warn: "warning", error: "warning" };
const LIFETIME: Record<ToastTone, number | null> = { ok: 6000, info: 9000, warn: 14_000, error: null };
const MAX_VISIBLE = 3;

let region: HTMLElement | null = null;

export function mountToasts(parent: HTMLElement): void {
  region = h("div", { class: "toasts", attrs: { "aria-live": "polite", "aria-relevant": "additions" } });
  parent.appendChild(region);
}

export function toast(tone: ToastTone, title: string, body?: string | null): void {
  if (!region) return;
  const close = h("button", {
    class: "toast__close",
    attrs: { type: "button", "aria-label": "Cerrar aviso" },
  });
  close.appendChild(icon("close"));
  const el = h(
    "div",
    { class: `toast toast--${tone}`, attrs: tone === "error" ? { role: "alert" } : undefined },
    h("span", "toast__icon", icon(ICON[tone])),
    h("div", "toast__text", h("p", { class: "toast__title", text: title }), body ? h("p", { class: "toast__body", text: body }) : null),
    close,
  );
  const dismiss = () => el.remove();
  close.addEventListener("click", dismiss);
  region.appendChild(el);
  while (region.childElementCount > MAX_VISIBLE) region.firstElementChild?.remove();
  const lifetime = LIFETIME[tone];
  if (lifetime) window.setTimeout(dismiss, lifetime);
}

/** Polite announcement without a visible toast (e.g. "Nuevo pedido #1043"). */
let announcer: HTMLElement | null = null;

export function mountAnnouncer(parent: HTMLElement): void {
  announcer = h("div", { class: "sr-only", attrs: { "aria-live": "assertive", "aria-atomic": "true" } });
  parent.appendChild(announcer);
}

export function announce(text: string): void {
  if (!announcer) return;
  announcer.textContent = "";
  window.setTimeout(() => {
    if (announcer) announcer.textContent = text;
  }, 60);
}
