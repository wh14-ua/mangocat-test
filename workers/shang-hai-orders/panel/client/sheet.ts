/**
 * Bottom sheets as native modal dialogs: the rest of the page becomes inert (focus stays
 * inside), Escape and the backdrop close them, and focus returns to what opened them.
 * While a request runs the sheet is "busy" and cannot be dismissed by accident.
 */
import { focusQuietly, h, icon } from "./dom";

export type Sheet = {
  dialog: HTMLDialogElement;
  body: HTMLElement;
  close: () => void;
  setBusy: (busy: boolean) => void;
  isOpen: () => boolean;
};

export type SheetOptions = {
  title: string;
  className?: string;
  /** Where focus goes on close when the opener no longer exists (e.g. the card moved). */
  fallbackFocus?: () => HTMLElement | null;
  onClose?: () => void;
  build: (sheet: Sheet) => void;
};

let seq = 0;
let openCount = 0;

export function openSheet(options: SheetOptions): Sheet {
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const titleId = `sheet-title-${++seq}`;
  const dialog = h("dialog", { class: `sheet ${options.className ?? ""}`.trim(), attrs: { "aria-labelledby": titleId } });
  const title = h("h2", { class: "sheet__title", attrs: { id: titleId, tabindex: "-1" }, text: options.title });
  const closeButton = h("button", { class: "iconbtn sheet__close", attrs: { type: "button", "aria-label": "Cerrar" } }, icon("close"));
  const body = h("div", "sheet__body");
  dialog.appendChild(
    h("div", "sheet__inner", h("div", { class: "sheet__grab", attrs: { "aria-hidden": "true" } }), h("div", "sheet__head", title, closeButton), body),
  );

  let busy = false;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    if (dialog.open) dialog.close();
  };
  dialog.addEventListener("close", () => {
    closed = true;
    dialog.remove();
    openCount = Math.max(0, openCount - 1);
    if (!openCount) document.documentElement.classList.remove("has-sheet");
    options.onClose?.();
    if (opener && opener.isConnected) focusQuietly(opener);
    else focusQuietly(options.fallbackFocus?.() ?? null);
  });
  dialog.addEventListener("cancel", (event) => {
    if (busy) event.preventDefault();
  });
  // A tap on the dimmed backdrop lands on the <dialog> itself.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog && !busy) close();
  });
  closeButton.addEventListener("click", () => {
    if (!busy) close();
  });

  const sheet: Sheet = {
    dialog,
    body,
    close,
    setBusy(value) {
      busy = value;
      closeButton.disabled = value;
      dialog.toggleAttribute("aria-busy", value);
    },
    isOpen: () => !closed,
  };
  options.build(sheet);
  document.body.appendChild(dialog);
  openCount += 1;
  document.documentElement.classList.add("has-sheet");
  dialog.showModal();
  focusQuietly(body.querySelector<HTMLElement>("[data-autofocus]") ?? title);
  return sheet;
}

/** A small yes/no confirmation built on the same sheet. */
export function confirmSheet(options: {
  title: string;
  text: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: (sheet: Sheet) => void | Promise<void>;
}): Sheet {
  return openSheet({
    title: options.title,
    build(sheet) {
      const confirm = h("button", {
        class: options.danger ? "btn btn--stop" : "btn btn--ink",
        attrs: { type: "button" },
        text: options.confirmLabel,
      });
      const back = h("button", { class: "btn btn--quiet", attrs: { type: "button", "data-autofocus": true }, text: "Volver" });
      confirm.addEventListener("click", () => void options.onConfirm(sheet));
      back.addEventListener("click", () => sheet.close());
      sheet.body.append(h("p", { class: "sheet__lead", text: options.text }), h("div", "sheet__actions", confirm, back));
    },
  });
}
