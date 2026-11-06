/**
 * The order ticket ("comanda"). Its coloured head tells the state from across the counter:
 * yellow = new, red = needs review, blue = in the kitchen, green = ready, white = closed.
 * Buttons come only from the server's `actions` list.
 */
import { h, icon } from "./dom";
import {
  ago,
  ALERT_TEXT,
  clock,
  clockAt,
  euros,
  itemsText,
  mailHref,
  minutesText,
  orderRef,
  PAYMENT_TEXT,
  telHref,
} from "./format";
import { state } from "./state";
import type { Card, OrderDetail, StaffAction } from "./types";

export type TicketMode = "board" | "detail";
export type Kind = "new" | "review" | "processing" | "prep" | "ready" | "done" | "rejected" | "other";

export type ActionHandler = (card: Card, action: StaffAction, button: HTMLButtonElement) => void;

let actionHandler: ActionHandler = () => undefined;
export function setActionHandler(handler: ActionHandler): void {
  actionHandler = handler;
}

export function kindOf(card: Pick<Card, "status" | "column">): Kind {
  switch (card.status) {
    case "awaiting_acceptance":
      return "new";
    case "needs_review":
      return "review";
    case "accepting":
    case "rejecting":
      return "processing";
    case "preparing":
      return "prep";
    case "ready":
      return "ready";
    case "completed":
      return "done";
    case "rejected":
    case "cancelled":
      return "rejected";
    default:
      return "other";
  }
}

function stateLabel(card: Card, kind: Kind): string {
  switch (kind) {
    case "new":
      return "Nuevo pedido";
    case "review":
      return "En revisión";
    case "processing":
      return "Procesando…";
    case "prep":
      return "En preparación";
    case "ready":
      return "Listo para recoger";
    case "done":
      return "Entregado";
    case "rejected":
      return card.status === "cancelled" ? "Cancelado" : "Rechazado";
    default:
      return card.statusLabel;
  }
}

/** Label + time shown on the right of the ticket head. In the kitchen: the live countdown. */
function headTime(card: Card, kind: Kind): { label: string; time: string; sub: HTMLElement | null; due?: string } {
  switch (kind) {
    case "prep":
      if (card.readyBy) return { label: "Faltan", time: "", sub: null, due: card.readyBy };
      return { label: "Aceptado a las", time: clock(card.acceptedAt), sub: null };
    case "ready":
      return { label: "Listo a las", time: clock(card.readyAt), sub: null };
    case "done":
      return { label: "Entregado a las", time: clock(card.completedAt ?? card.updatedAt), sub: null };
    case "rejected":
      return { label: card.status === "cancelled" ? "Cancelado a las" : "Rechazado a las", time: clock(card.rejectedAt ?? card.updatedAt), sub: null };
    default:
      return {
        label: "Hora",
        time: clock(card.createdAt),
        sub: h("span", { class: "tk__sub", attrs: { "data-ago": card.createdAt }, text: ago(card.createdAt, Date.now() + state.offset) }),
      };
  }
}

function titleBlock(card: Card, kind: Kind, mode: TicketMode, compact: boolean): HTMLElement {
  const inner: (HTMLElement | string)[] = compact
    ? [h("span", { class: "tk__num", text: orderRef(card) }), h("span", { class: "tk__who", text: card.customer.name })]
    : [h("span", { class: "tk__state", text: stateLabel(card, kind) }), " ", h("span", { class: "tk__num", text: orderRef(card) })];
  if (mode === "detail") return h("div", { class: "tk__title" }, ...inner);
  const link = h("a", { class: "tk__link", attrs: { href: `#pedido=${encodeURIComponent(card.id)}`, "data-focus": "link" } }, ...inner);
  return h("h3", { class: "tk__title" }, link);
}

function head(card: Card, kind: Kind, mode: TicketMode): HTMLElement {
  const when = headTime(card, kind);
  const box = h(
    "p",
    { class: "tk__when", attrs: when.due ? { "data-due-head": when.due } : undefined },
    h("span", { class: "tk__when-label", text: when.label }),
    h("span", { class: "tk__time", text: when.time }),
    when.sub,
  );
  if (when.due) paintCountdown(box, Date.now() + state.offset);
  return h("header", "tk__head", titleBlock(card, kind, mode, false), box, mode === "board" ? h("span", "tk__chev", icon("chevron")) : null);
}

/** "Faltan 8 min" / "Retrasado 6 min" in the head of a ticket in the kitchen. */
function paintCountdown(box: HTMLElement, now: number): void {
  const due = Date.parse(box.dataset.dueHead ?? "");
  if (!Number.isFinite(due)) return;
  const diff = due - now;
  const late = diff < 0;
  const label = late ? "Retrasado" : "Faltan";
  const value = late ? minutesText(Math.max(1, Math.floor(-diff / 60_000))) : diff < 60_000 ? "< 1 min" : minutesText(Math.ceil(diff / 60_000));
  const [labelEl, valueEl] = [box.querySelector(".tk__when-label"), box.querySelector(".tk__time")];
  if (labelEl && labelEl.textContent !== label) labelEl.textContent = label;
  if (valueEl && valueEl.textContent !== value) valueEl.textContent = value;
  box.classList.toggle("is-late", late);
}

/** Review reason, Stripe in progress, kitchen timer, waiting time or rejection reason. */
function statusNote(card: Card, kind: Kind, mode: TicketMode): HTMLElement | null {
  const now = Date.now() + state.offset;
  switch (kind) {
    case "review":
      return h(
        "div",
        { class: "note note--danger", attrs: { role: mode === "detail" ? null : "note" } },
        icon("warning", "ico note__ico"),
        h(
          "div",
          null,
          h("p", { class: "note__title", text: "Revisa este pedido antes de seguir" }),
          h("p", { class: "note__text", text: card.reviewReason ?? "Algo no cuadra con el pago de este pedido." }),
        ),
      );
    case "processing": {
      const accepting = card.status === "accepting";
      const stale = card.actions.includes("retry");
      return h(
        "div",
        "note note--info",
        icon("spinner", "ico note__ico spin"),
        h(
          "div",
          null,
          h("p", { class: "note__title", text: accepting ? "Aceptando: cobrando el pago en Stripe" : "Rechazando: anulando el pago en Stripe" }),
          h("p", {
            class: "note__text",
            text: stale
              ? "Stripe no ha confirmado todavía. Pulsa REINTENTAR para comprobarlo."
              : accepting
                ? "No prepares el pedido hasta que pase a EN PREPARACIÓN."
                : "Se resolverá solo en un momento.",
          }),
        ),
      );
    }
    case "prep": {
      if (!card.readyBy) return null;
      const progress = h("progress", {
        class: "timer__bar",
        attrs: {
          max: "1000",
          value: "0",
          "data-from": card.acceptedAt ?? card.updatedAt,
          "data-to": card.readyBy,
          "aria-label": "Tiempo de preparación transcurrido",
        },
      });
      const block = h(
        "div",
        "timer",
        h(
          "p",
          "timer__line",
          h("span", { class: "timer__eta", text: `Listo hacia las ${clock(card.readyBy)}` }),
          card.prepMinutes ? h("span", { class: "timer__span", text: ` (${minutesText(card.prepMinutes)})` }) : null,
        ),
        progress,
      );
      tickTimes(block, now);
      return block;
    }
    case "ready":
      return h(
        "p",
        "waitline",
        icon("clock"),
        h(
          "span",
          null,
          "Esperando al cliente desde ",
          h("span", { attrs: { "data-ago": card.readyAt ?? card.updatedAt }, text: ago(card.readyAt ?? card.updatedAt, now) }),
        ),
      );
    case "rejected":
      return card.rejectionReason
        ? h("p", "reason", h("span", { class: "reason__label", text: "Motivo: " }), h("span", { text: card.rejectionReason }))
        : null;
    default:
      return null;
  }
}

function chips(card: Card): HTMLElement | null {
  const list: HTMLElement[] = [];
  if (card.mode === "stripe-test") list.push(h("span", { class: "chip chip--test", text: "PRUEBA" }));
  if (card.locale === "en") list.push(h("span", "chip", icon("globe"), h("span", { text: "Cliente en inglés" })));
  return list.length ? h("div", "chips", ...list) : null;
}

function fact(label: string, value: Node | string): HTMLElement {
  return h("div", "facts__row", h("dt", { text: label }), h("dd", null, value));
}

function facts(card: Card, detail: OrderDetail | null): HTMLElement {
  const tel = telHref(card.customer.phone);
  const phone = tel
    ? h(
        "a",
        { class: "phone", attrs: { href: tel, "aria-label": `Llamar a ${card.customer.name}: ${card.customer.phoneDisplay}` } },
        icon("phone"),
        h("span", { text: card.customer.phoneDisplay }),
      )
    : document.createTextNode(card.customer.phoneDisplay);
  const rows = [fact("Cliente", card.customer.name), fact("Teléfono", phone)];
  if (detail) {
    const mail = mailHref(detail.email);
    rows.push(fact("Email", mail ? h("a", { class: "textlink", attrs: { href: mail }, text: detail.email }) : detail.email));
  }
  rows.push(
    fact(
      "Entrega",
      h(
        "span",
        "facts__with-icon",
        icon(card.fulfillment === "pickup" ? "bag" : "home"),
        h("span", { text: card.fulfillment === "pickup" ? "Recogida en el local" : "Reparto a domicilio" }),
      ),
    ),
  );
  return h("dl", "facts", ...rows);
}

function lines(card: Card): HTMLElement {
  return h(
    "ul",
    { class: "lines", attrs: { "aria-label": `Productos: ${itemsText(card.itemCount)}` } },
    ...card.lines.map((line) =>
      h(
        "li",
        "ln",
        h("span", { class: line.quantity > 1 ? "ln__qty ln__qty--multi" : "ln__qty", text: `${line.quantity} ×` }),
        h("span", "ln__name", line.name, line.options ? h("span", { class: "ln__opt", text: line.options }) : null),
        h("span", { class: "ln__price", text: euros(line.lineTotalCents) }),
      ),
    ),
  );
}

function notes(card: Card): HTMLElement | null {
  if (!card.notes?.trim()) return null;
  return h(
    "div",
    "notes",
    h("p", "notes__label", icon("note"), h("span", { text: "Observaciones" })),
    h("p", { class: "notes__text", text: card.notes.trim() }),
  );
}

function ageNote(card: Card): HTMLElement | null {
  if (!card.ageRestricted) return null;
  return h(
    "p",
    "age",
    h("span", { class: "age__badge", attrs: { "aria-hidden": "true" }, text: "18+" }),
    h("span", { text: "Incluye alcohol: comprobar DNI al recoger" }),
  );
}

export function payChip(card: Pick<Card, "paymentStatus">): HTMLElement {
  const info = PAYMENT_TEXT[card.paymentStatus] ?? { label: card.paymentStatus, tone: "muted" as const };
  return h("span", { class: `pay pay--${info.tone}`, text: info.label });
}

function total(card: Card): HTMLElement {
  return h(
    "div",
    "total",
    h("span", "total__label", "Total ", h("span", { class: "total__count", text: `(${itemsText(card.itemCount)})` })),
    h("span", { class: "total__amount", text: euros(card.totalCents) }),
  );
}

function alertLine(card: Card): HTMLElement | null {
  const text = ALERT_TEXT[card.alert];
  if (!text) return null;
  const tone = card.alert === "failed" ? "alertline alertline--failed" : "alertline";
  return h("p", tone, icon(card.alert === "sent" ? "send" : card.alert === "pending" ? "clock" : "warning"), h("span", { text }));
}

type ButtonSpec = { label: string; busy: string; cls: string };

function buttonSpec(action: StaffAction, kind: Kind): ButtonSpec {
  switch (action) {
    case "accept":
      return { label: "Aceptar pedido", busy: "Aceptando…", cls: "btn btn--go btn--xl" };
    case "reject":
      return kind === "prep" || kind === "ready"
        ? { label: "Cancelar y devolver", busy: "Cancelando…", cls: "btn btn--quiet-stop" }
        : { label: "Rechazar pedido", busy: "Rechazando…", cls: "btn btn--stop-line btn--caps" };
    case "ready":
      return { label: "Marcar como listo", busy: "Guardando…", cls: "btn btn--ink btn--xl" };
    case "complete":
      return { label: "Marcar como entregado", busy: "Guardando…", cls: "btn btn--ink btn--xl" };
    case "retry":
      return kind === "processing" || kind === "rejected"
        ? { label: "Reintentar", busy: "Comprobando…", cls: "btn btn--ink btn--caps" }
        : { label: "Reintentar", busy: "Comprobando…", cls: "btn btn--line btn--caps" };
  }
}

export function actionButtons(card: Card, kind: Kind): HTMLElement | null {
  if (!card.actions.length) return null;
  const pending = state.pending.get(card.id);
  const buttons = card.actions.map((action) => {
    const spec = buttonSpec(action, kind);
    const busy = pending === action;
    const button = h(
      "button",
      {
        class: spec.cls,
        attrs: { type: "button", "data-action": action, "data-focus": `action:${action}`, disabled: Boolean(pending), "aria-busy": busy ? "true" : null },
      },
      busy ? icon("spinner", "ico spin") : null,
      h("span", { text: busy ? spec.busy : spec.label }),
    );
    button.addEventListener("click", () => actionHandler(card, action, button));
    return button;
  });
  return h("div", "tk__actions", ...buttons);
}

/** Closed orders (delivered / rejected today) on the board: one compact row. */
function compactTicket(card: Card, kind: Kind): HTMLElement {
  const when = headTime(card, kind);
  const article = h(
    "article",
    { class: `tk tk--${kind} tk--compact`, attrs: { "data-id": card.id } },
    h(
      "header",
      "tk__head",
      titleBlock(card, kind, "board", true),
      h("p", "tk__amount", h("span", { text: euros(card.totalCents) })),
      h("span", "tk__chev", icon("chevron")),
    ),
    h(
      "div",
      "tk__body",
      h("p", "tk__meta", h("span", { text: `${when.label} ${when.time}` }), h("span", { text: itemsText(card.itemCount) })),
      statusNote(card, kind, "board"),
      h("div", "tk__paybox", payChip(card)),
      actionButtons(card, kind),
    ),
  );
  return article;
}

export function renderTicket(card: Card, mode: TicketMode = "board", detail: OrderDetail | null = null): HTMLElement {
  const kind = kindOf(card);
  if (mode === "board" && (kind === "done" || kind === "rejected" || kind === "other")) return compactTicket(card, kind);
  return h(
    "article",
    { class: `tk tk--${kind} tk--${mode}`, attrs: { "data-id": card.id } },
    head(card, kind, mode),
    h(
      "div",
      "tk__body",
      statusNote(card, kind, mode),
      chips(card),
      facts(card, detail),
      lines(card),
      notes(card),
      ageNote(card),
      total(card),
      h("div", "tk__paybox", payChip(card)),
      alertLine(card),
      actionButtons(card, kind),
    ),
  );
}

/** Everything that changes how a ticket looks, except the clock (see tickTimes). */
export function ticketSignature(card: Card): string {
  return `${JSON.stringify(card)}|${state.pending.get(card.id) ?? ""}`;
}

/** Updates relative times, countdowns and progress bars in place, once a second. */
export function tickTimes(root: ParentNode, now: number): void {
  root.querySelectorAll<HTMLElement>("[data-ago]").forEach((el) => {
    const text = ago(el.dataset.ago, now);
    if (el.textContent !== text) el.textContent = text;
  });
  root.querySelectorAll<HTMLElement>("[data-due-head]").forEach((el) => paintCountdown(el, now));
  root.querySelectorAll<HTMLElement>("[data-at-min]").forEach((el) => {
    const text = `hacia las ${clockAt(now + Number(el.dataset.atMin) * 60_000)}`;
    if (el.textContent !== text) el.textContent = text;
  });
  root.querySelectorAll<HTMLProgressElement>("progress[data-from]").forEach((bar) => {
    const from = Date.parse(bar.dataset.from ?? "");
    const to = Date.parse(bar.dataset.to ?? "");
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return;
    const value = Math.round(Math.min(1, Math.max(0, (now - from) / (to - from))) * 1000);
    if (bar.value !== value) bar.value = value;
    bar.classList.toggle("is-late", now > to);
  });
}
