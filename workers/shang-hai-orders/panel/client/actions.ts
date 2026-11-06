/**
 * What happens when staff press a button. ACEPTAR and RECHAZAR open a sheet first (time
 * to prepare / reason and what happens to the money); the others run at once. While a
 * request runs the order's buttons are disabled (no double taps). The server's message is
 * always shown, whatever the outcome.
 */
import { api } from "./api";
import { kindOf, setActionHandler } from "./cards";
import { h, icon } from "./dom";
import { acceptMoneyText, clock, clockAt, orderRef, rejectMoneyText, statusText } from "./format";
import { requestRefresh } from "./poll";
import { prefs, savePrefs } from "./prefs";
import { openSheet, type Sheet } from "./sheet";
import { emit, findCard, on, serverNow, state, upsertCard } from "./state";
import { toast } from "./toast";
import type { ActionReply, Card, StaffAction } from "./types";

const PREP_MIN = 5;
const PREP_MAX = 180;
const REASONS = ["Sin existencias", "Cocina cerrada", "Demasiados pedidos", "Fuera de horario"];

let onUnauthorized: () => void = () => undefined;
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}

type Outcome = { kind: "done" | "pending" | "conflict" | "invalid" | "failed" | "network" | "auth"; message: string };

function fallbackMessage(status: number): string {
  switch (status) {
    case 403:
      return "El servidor no ha aceptado la petición. Recarga el panel y vuelve a intentarlo.";
    case 404:
      return "No existe ese pedido.";
    case 503:
      return "El servicio no está disponible ahora mismo. Inténtalo en un momento.";
    default:
      return `Error del servidor (${status}). Inténtalo de nuevo en un momento.`;
  }
}

function successTitle(card: Card, action: StaffAction, reply: ActionReply): string {
  const ref = orderRef(card);
  const order = reply.order;
  switch (action) {
    case "accept":
      return order?.readyBy ? `Pedido ${ref} aceptado · listo hacia las ${clock(order.readyBy)}` : `Pedido ${ref} aceptado`;
    case "reject": {
      const kind = kindOf(card);
      return kind === "prep" || kind === "ready" ? `Pedido ${ref} cancelado` : `Pedido ${ref} rechazado`;
    }
    default:
      return `Pedido ${ref}`;
  }
}

async function run(card: Card, action: StaffAction, body: Record<string, unknown>): Promise<Outcome> {
  state.pending.set(card.id, action);
  emit("pending");
  // Tell the server what this phone showed: if another phone changed the order meanwhile, the
  // action is refused (409) instead of being applied to a situation nobody saw.
  const res = await api.action(card.id, action, { ...body, expectedStatus: card.status });
  state.pending.delete(card.id);
  state.mutations += 1;
  const ref = orderRef(card);

  if (res.ok) {
    const reply = res.data;
    if (reply.order) upsertCard(reply.order);
    emit("pending");
    emit("board");
    requestRefresh();
    const message = reply.message ?? "";
    if (res.status === 202 || reply.pending) {
      toast("warn", `Pedido ${ref}: procesando…`, message || "Stripe todavía no ha respondido.");
      return { kind: "pending", message };
    }
    toast("ok", successTitle(card, action, reply), message || null);
    return { kind: "done", message };
  }

  emit("pending");
  if (res.network) {
    const message = res.timedOut
      ? "El servidor no ha respondido a tiempo. Comprueba el pedido antes de repetir."
      : "Sin conexión. No se ha podido enviar: comprueba la conexión y vuelve a intentarlo.";
    requestRefresh();
    return { kind: "network", message };
  }
  if (res.status === 401) {
    onUnauthorized();
    return { kind: "auth", message: "" };
  }
  const message = res.data?.message ?? fallbackMessage(res.status);
  if (res.data?.order) {
    upsertCard(res.data.order);
    emit("board");
  }
  if (res.status === 422) return { kind: "invalid", message };
  toast(res.status === 409 ? "warn" : "error", `Pedido ${ref}`, message);
  requestRefresh();
  return { kind: res.status === 409 ? "conflict" : "failed", message };
}

function setButtonBusy(button: HTMLButtonElement, busy: boolean, label: string): void {
  button.replaceChildren(...(busy ? [icon("spinner", "ico spin")] : []), h("span", { text: label }));
  button.toggleAttribute("aria-busy", busy);
}

/** Watches the board while a sheet is open: the order may be handled from another phone. */
function watchOrder(sheet: Sheet, card: Card, action: StaffAction, notice: HTMLElement, confirm: HTMLButtonElement, isBusy: () => boolean) {
  const stop = on("board", () => {
    if (!sheet.isOpen()) return stop();
    if (isBusy()) return;
    const fresh = findCard(card.id);
    if (fresh && fresh.actions.includes(action)) return;
    notice.hidden = false;
    notice.replaceChildren(
      icon("warning", "ico note__ico"),
      h("p", { class: "note__text", text: `Este pedido ha cambiado mientras tanto: ahora está ${fresh ? statusText(fresh.status).toLowerCase() : "fuera del tablero"}. Revisa el tablero.` }),
    );
    confirm.disabled = true;
  });
  return stop;
}

function fallbackFocusFor(id: string): () => HTMLElement | null {
  return () =>
    document.querySelector<HTMLElement>(`.tk[data-id="${CSS.escape(id)}"] [data-focus="link"]`) ??
    document.getElementById("board-title");
}

// ---------------------------------------------------------------------------
// ACEPTAR: choose the preparation time
// ---------------------------------------------------------------------------

function openAcceptSheet(card: Card): void {
  const options = state.board?.prepOptions?.length ? state.board.prepOptions : [15, 20, 30, 45];
  let chosen: number | null = prefs.lastPrep !== null && options.includes(prefs.lastPrep) ? prefs.lastPrep : null;
  let busy = false;
  let stopWatching: () => void = () => undefined;

  openSheet({
    title: `Aceptar pedido ${orderRef(card)}`,
    fallbackFocus: fallbackFocusFor(card.id),
    onClose: () => stopWatching(),
    build(sheet) {
      const radios: HTMLInputElement[] = [];
      const tiles = options.map((minutes, index) => {
        const input = h("input", {
          class: "prep__radio",
          attrs: { type: "radio", name: "prep", value: String(minutes), checked: chosen === minutes, "data-autofocus": chosen === minutes || (chosen === null && index === 0) },
        });
        radios.push(input);
        return h(
          "label",
          "prep__opt",
          input,
          h(
            "span",
            "prep__face",
            h("span", { class: "prep__min", text: `${minutes} min` }),
            h("span", { class: "prep__at", attrs: { "data-at-min": String(minutes) }, text: `hacia las ${clockAt(serverNow() + minutes * 60_000)}` }),
          ),
        );
      });
      const otherId = `other-${card.id}`;
      const errorId = `other-error-${card.id}`;
      const other = h("input", {
        class: "input input--min",
        attrs: { id: otherId, type: "number", inputmode: "numeric", min: PREP_MIN, max: PREP_MAX, step: 1, placeholder: "Ej.: 25", "aria-describedby": errorId, autocomplete: "off" },
      });
      const error = h("p", { class: "field__error", attrs: { id: errorId, hidden: true } });
      const notice = h("div", { class: "note note--warn", attrs: { hidden: true, role: "status" } });
      const confirm = h("button", { class: "btn btn--go btn--xl", attrs: { type: "submit" } });
      const back = h("button", { class: "btn btn--quiet", attrs: { type: "button" }, text: "Volver" });

      const refreshConfirm = () => {
        if (busy) return;
        confirm.disabled = chosen === null || !notice.hidden;
        setButtonBusy(confirm, false, chosen === null ? "Elige un tiempo" : `Aceptar · listo en ${chosen} min`);
      };
      const showError = (text: string | null) => {
        error.hidden = !text;
        error.textContent = text ?? "";
        other.toggleAttribute("aria-invalid", Boolean(text));
      };
      for (const radio of radios) {
        radio.addEventListener("change", () => {
          chosen = Number(radio.value);
          other.value = "";
          showError(null);
          refreshConfirm();
        });
      }
      other.addEventListener("input", () => {
        const value = other.value.trim();
        if (!value) {
          chosen = radios.find((r) => r.checked) ? Number(radios.find((r) => r.checked)?.value) : null;
          showError(null);
          refreshConfirm();
          return;
        }
        for (const radio of radios) radio.checked = false;
        const n = Number(value);
        chosen = Number.isInteger(n) && n >= PREP_MIN && n <= PREP_MAX ? n : null;
        showError(chosen === null ? `Escribe un tiempo entre ${PREP_MIN} y ${PREP_MAX} minutos.` : null);
        refreshConfirm();
      });

      const form = h(
        "form",
        { class: "sheet__form", attrs: { novalidate: true } },
        h("p", { class: "sheet__lead", text: "¿Cuánto tardaréis en tenerlo listo? Es una estimación para el cliente." }),
        h("fieldset", "prep", h("legend", { class: "sr-only", text: "Tiempo de preparación" }), ...tiles),
        h("div", "field field--row", h("label", { class: "field__label", attrs: { for: otherId }, text: "Otro tiempo" }), h("span", "minbox", other, h("span", { class: "minbox__unit", text: "min" }))),
        error,
        h("p", "money", icon("card"), h("span", { text: acceptMoneyText(card) })),
        notice,
        h("div", "sheet__actions", confirm, back),
      );
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (busy || chosen === null) {
          if (chosen === null && other.value.trim()) other.focus();
          return;
        }
        const minutes = chosen;
        busy = true;
        sheet.setBusy(true);
        confirm.disabled = true;
        back.disabled = true;
        setButtonBusy(confirm, true, "Aceptando…");
        void run(card, "accept", { prepMinutes: minutes }).then((outcome) => {
          busy = false;
          sheet.setBusy(false);
          back.disabled = false;
          if (outcome.kind === "invalid" || outcome.kind === "network") {
            showError(outcome.message);
            refreshConfirm();
            return;
          }
          if (outcome.kind === "done" || outcome.kind === "pending") savePrefs({ lastPrep: minutes });
          sheet.close();
        });
      });
      back.addEventListener("click", () => sheet.close());
      sheet.body.appendChild(form);
      refreshConfirm();
      stopWatching = watchOrder(sheet, card, "accept", notice, confirm, () => busy);
    },
  });
}

// ---------------------------------------------------------------------------
// RECHAZAR / Cancelar y devolver: confirm, optional reason, what happens to the money
// ---------------------------------------------------------------------------

function openRejectSheet(card: Card): void {
  const kind = kindOf(card);
  const cancelling = kind === "prep" || kind === "ready";
  const ref = orderRef(card);
  let busy = false;
  let stopWatching: () => void = () => undefined;

  openSheet({
    title: cancelling ? `Cancelar y devolver ${ref}` : `Rechazar pedido ${ref}`,
    className: "sheet--danger",
    fallbackFocus: fallbackFocusFor(card.id),
    onClose: () => stopWatching(),
    build(sheet) {
      const reasonId = `reason-${card.id}`;
      const hintId = `reason-hint-${card.id}`;
      const reason = h("textarea", {
        class: "input input--area",
        attrs: { id: reasonId, maxlength: 200, rows: 2, placeholder: "Escribe otro motivo (opcional)", "aria-describedby": hintId },
      });
      const counter = h("span", { class: "field__count", attrs: { "aria-hidden": "true" }, text: "0/200" });
      const chips = REASONS.map((text) =>
        h("button", { class: "reason-chip", attrs: { type: "button", "aria-pressed": "false" }, text }),
      );
      const syncChips = () => {
        const value = reason.value.trim();
        for (const chip of chips) chip.setAttribute("aria-pressed", String(chip.textContent === value));
        counter.textContent = `${reason.value.length}/200`;
      };
      chips.forEach((chip) =>
        chip.addEventListener("click", () => {
          reason.value = chip.getAttribute("aria-pressed") === "true" ? "" : (chip.textContent ?? "");
          syncChips();
        }),
      );
      reason.addEventListener("input", syncChips);

      const error = h("p", { class: "field__error", attrs: { hidden: true, role: "alert" } });
      const notice = h("div", { class: "note note--warn", attrs: { hidden: true, role: "status" } });
      const confirmLabel = cancelling ? "Cancelar y devolver" : "Confirmar rechazo";
      const confirm = h("button", { class: "btn btn--stop btn--xl", attrs: { type: "submit" } }, h("span", { text: confirmLabel }));
      const back = h("button", { class: "btn btn--quiet", attrs: { type: "button", "data-autofocus": true }, text: "Volver" });

      const form = h(
        "form",
        { class: "sheet__form", attrs: { novalidate: true } },
        h("div", "money money--box", icon("card"), h("p", { class: "money__text", text: rejectMoneyText(card) })),
        h(
          "fieldset",
          "reasons",
          h("legend", { class: "field__label", text: "Motivo (opcional)" }),
          h("div", "reasons__chips", ...chips),
          h("label", { class: "sr-only", attrs: { for: reasonId }, text: "Motivo" }),
          reason,
          h("p", "field__hint", h("span", { attrs: { id: hintId }, text: "El cliente verá este motivo." }), counter),
        ),
        error,
        notice,
        h("div", "sheet__actions", confirm, back),
      );
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (busy) return;
        busy = true;
        sheet.setBusy(true);
        confirm.disabled = true;
        back.disabled = true;
        setButtonBusy(confirm, true, cancelling ? "Cancelando…" : "Rechazando…");
        const text = reason.value.trim();
        void run(card, "reject", text ? { reason: text } : {}).then((outcome) => {
          busy = false;
          sheet.setBusy(false);
          back.disabled = false;
          if (outcome.kind === "invalid" || outcome.kind === "network") {
            error.hidden = false;
            error.textContent = outcome.message;
            confirm.disabled = !notice.hidden;
            setButtonBusy(confirm, false, confirmLabel);
            return;
          }
          sheet.close();
        });
      });
      back.addEventListener("click", () => sheet.close());
      sheet.body.appendChild(form);
      stopWatching = watchOrder(sheet, card, "reject", notice, confirm, () => busy);
    },
  });
}

/** Single entry point for every action button (board and detail). */
export function handleAction(card: Card, action: StaffAction): void {
  if (state.pending.has(card.id)) return;
  if (action === "accept") return openAcceptSheet(card);
  if (action === "reject") return openRejectSheet(card);
  void run(card, action, {});
}

export function installActionHandler(): void {
  setActionHandler((card, action) => handleAction(card, action));
}
