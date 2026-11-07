/**
 * Order detail (tap a ticket, or open PANEL_URL?pedido=<id> / #pedido=<id> from an alert): the
 * full ticket with its actions, plus email, payment details, history and alert log.
 */
import { api } from "./api";
import { kindOf, payChip, renderTicket } from "./cards";
import { byId, focusQuietly, h, icon } from "./dom";
import {
  MODE_TEXT,
  NOTIFICATION_KIND_TEXT,
  NOTIFICATION_STATUS_TEXT,
  ORDER_ID,
  orderRef,
  REFUND_STATUS_TEXT,
  SOURCE_TEXT,
  STRIPE_STATUS_TEXT,
  stamp,
  statusText,
} from "./format";
import { emit, findCard, on, serverNow, state } from "./state";
import { toast } from "./toast";
import type { OrderDetail } from "./types";

const REFRESH_MS = 15_000;

let current: OrderDetail | null = null;
let loadSeq = 0;
let timer = 0;
let returnScroll = 0;
let returnFocusId: string | null = null;
let onUnauthorized: () => void = () => undefined;

export function initDetail(handlers: { onUnauthorized: () => void }): void {
  onUnauthorized = handlers.onUnauthorized;
  on("pending", () => {
    if (state.detailId && current) paint();
  });
  on("board", () => {
    if (!state.detailId || !current) return;
    const card = findCard(state.detailId);
    if (card && card.updatedAt !== current.updatedAt) void load(state.detailId, false);
  });
}

function section(title: string, iconName: Parameters<typeof icon>[0], ...content: (HTMLElement | null)[]): HTMLElement {
  return h("section", "panel", h("h3", "panel__title", icon(iconName), h("span", { text: title })), ...content);
}

function row(label: string, value: Node | string | null): HTMLElement | null {
  if (value === null || value === "") return null;
  return h("div", "facts__row", h("dt", { text: label }), h("dd", null, value));
}

function stripeWords(table: Record<string, string>, raw: string): HTMLElement {
  const words = table[raw];
  return words ? h("span", null, words, " ", h("span", { class: "mono muted", text: `(${raw})` })) : h("span", { class: "mono", text: raw });
}

function paymentSection(order: OrderDetail): HTMLElement {
  const now = serverNow();
  const p = order.payment;
  return section(
    "Pago",
    "card",
    h(
      "dl",
      "facts facts--wide",
      row("Estado", payChip(order)),
      row("Modo", p.mode === "stripe-test" ? `${MODE_TEXT["stripe-test"]} (no se cobra dinero real)` : p.mode === "stripe-live" ? MODE_TEXT["stripe-live"] : p.mode),
      row("Estado en Stripe", p.stripeStatus ? stripeWords(STRIPE_STATUS_TEXT, p.stripeStatus) : null),
      row("Devolución", p.refundStatus ? stripeWords(REFUND_STATUS_TEXT, p.refundStatus) : null),
      row("Autorizado", order.authorizedAt ? stamp(order.authorizedAt, now) : null),
      row("Cobrar antes de", order.paymentStatus === "authorized" && order.captureBefore ? stamp(order.captureBefore, now) : null),
      row("Referencia Stripe", p.stripePaymentIntentId ? h("span", { class: "mono", text: p.stripePaymentIntentId }) : null),
    ),
  );
}

function historySection(order: OrderDetail): HTMLElement {
  const now = serverNow();
  if (!order.events.length) return section("Historial", "history", h("p", { class: "muted", text: "Sin cambios registrados." }));
  const items = [...order.events].reverse().map((event) => {
    const change = event.from ? `${statusText(event.from)} → ${statusText(event.to)}` : statusText(event.to);
    const who = [SOURCE_TEXT[event.source] ?? event.source, event.actor].filter(Boolean).join(": ");
    return h(
      "li",
      "timeline__item",
      h("time", { class: "timeline__time", attrs: { datetime: event.at }, text: stamp(event.at, now) }),
      h(
        "div",
        "timeline__body",
        h("p", { class: "timeline__change", text: change }),
        event.note ? h("p", { class: "timeline__note", text: event.note }) : null,
        h("p", { class: "timeline__who", text: who }),
      ),
    );
  });
  return section("Historial", "history", h("ol", "timeline", ...items));
}

function alertsSection(order: OrderDetail): HTMLElement {
  const now = serverNow();
  if (!order.notifications.length) return section("Avisos", "send", h("p", { class: "muted", text: "No se ha enviado ningún aviso de este pedido." }));
  const items = order.notifications.map((n) => {
    const statusTextValue = NOTIFICATION_STATUS_TEXT[n.status] ?? n.status;
    const failed = n.status === "failed";
    const details = [
      n.readAt ? `Leído ${stamp(n.readAt, now)}` : n.deliveredAt ? `Entregado ${stamp(n.deliveredAt, now)}` : n.sentAt ? `Enviado ${stamp(n.sentAt, now)}${n.channel === "whatsapp" ? " (sin confirmar entrega)" : ""}` : null,
      n.attempts ? (n.attempts === 1 ? "1 intento" : `${n.attempts} intentos`) : null,
      n.nextAttemptAt && n.status !== "sent" ? `Próximo intento ${stamp(n.nextAttemptAt, now)}` : null,
    ].filter((x): x is string => Boolean(x));
    return h(
      "li",
      "alertlog__item",
      h(
        "p",
        "alertlog__head",
        h("span", { class: "alertlog__kind", text: `${NOTIFICATION_KIND_TEXT[n.kind] ?? n.kind} (${n.channel === "whatsapp" ? "WhatsApp" : n.channel === "telegram" ? "Telegram" : n.channel})` }),
        h("span", { class: failed ? "badge badge--danger" : n.status === "sent" ? "badge badge--ok" : "badge", text: statusTextValue }),
      ),
      details.length ? h("p", { class: "alertlog__meta", text: details.join(" · ") }) : null,
      n.lastError ? h("p", { class: "alertlog__error", text: `Último error: ${n.lastError}` }) : null,
    );
  });
  return section("Avisos", "send", h("ul", "alertlog", ...items));
}

function paint(): void {
  const root = byId("detail");
  const body = root.querySelector(".detail__body");
  if (!body || !current) return;
  const order = current;
  const title = byId("detail-title");
  title.textContent = `Pedido ${orderRef(order)}`;
  // Prefer the live board copy for the parts the board refreshes every 5 s.
  const live = findCard(order.id);
  const card = live && live.updatedAt >= order.updatedAt ? { ...order, ...live } : order;
  body.replaceChildren(renderTicket(card, "detail", order), paymentSection(order), historySection(order), alertsSection(order));
  root.dataset.kind = kindOf(card);
}

async function load(id: string, showSpinner: boolean): Promise<void> {
  const seq = ++loadSeq;
  const root = byId("detail");
  const body = root.querySelector(".detail__body");
  if (showSpinner && body) body.replaceChildren(h("p", { class: "loading", text: "Cargando pedido…" }));
  const res = await api.order(id);
  if (seq !== loadSeq || state.detailId !== id) return;
  if (res.ok) {
    current = res.data.order;
    paint();
    return;
  }
  if (res.status === 401) return onUnauthorized();
  if (res.status === 404) {
    toast("warn", "No se ha encontrado ese pedido", "Puede que el enlace sea antiguo o esté incompleto.");
    closeDetail();
    return;
  }
  if (!current && body) {
    body.replaceChildren(
      h("div", "empty", icon("offline", "ico empty__ico"), h("p", { class: "empty__title", text: "No se ha podido cargar el pedido" }), h("p", { class: "empty__text", text: "Volveremos a intentarlo en unos segundos." })),
    );
  }
}

/** Opens the detail for an order id (from a ticket or the URL fragment). */
export function openDetail(id: string, fromBoard: boolean): void {
  if (!ORDER_ID.test(id)) {
    toast("warn", "Enlace de pedido no válido", "Abre el pedido desde el tablero.");
    clearHash();
    return;
  }
  const root = byId("detail");
  if (state.detailId !== id) {
    current = null;
    if (!state.detailId) returnScroll = window.scrollY;
    returnFocusId = fromBoard ? id : null;
  }
  state.detailId = id;
  if (!root.querySelector(".detail__body")) {
    const back = h("button", { class: "backbtn", attrs: { type: "button" } }, icon("back"), h("span", { text: "Volver" }));
    back.addEventListener("click", () => closeDetail());
    root.replaceChildren(
      h("div", "detail__bar", back, h("h2", { class: "detail__title", attrs: { id: "detail-title", tabindex: "-1" }, text: "Pedido" })),
      h("div", "detail__body"),
    );
    root.setAttribute("aria-labelledby", "detail-title");
  }
  byId("board").hidden = true;
  root.hidden = false;
  window.scrollTo({ top: 0 });
  focusQuietly(byId("detail-title"));
  void load(id, true);
  window.clearInterval(timer);
  timer = window.setInterval(() => {
    if (state.detailId && document.visibilityState === "visible") void load(state.detailId, false);
  }, REFRESH_MS);
  emit("route");
}

function clearHash(): void {
  if (window.location.hash) history.replaceState(history.state, "", window.location.pathname + window.location.search);
}

/** Back to the board, restoring where the staff member was. */
export function closeDetail(): void {
  if (!state.detailId) return;
  const id = state.detailId;
  state.detailId = null;
  current = null;
  window.clearInterval(timer);
  const root = byId("detail");
  root.hidden = true;
  root.replaceChildren();
  byId("board").hidden = false;
  if (history.state && (history.state as { detail?: string }).detail === id) history.back();
  else clearHash();
  window.scrollTo({ top: returnScroll });
  const ticketLink = returnFocusId ? document.querySelector<HTMLElement>(`.tk[data-id="${CSS.escape(returnFocusId)}"] [data-focus="link"]`) : null;
  focusQuietly(ticketLink ?? byId("board-title"));
  emit("route");
}

export function detailOpen(): boolean {
  return state.detailId !== null;
}
