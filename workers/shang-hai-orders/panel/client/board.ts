/**
 * The main screen: brand bar with freshness, five sections with live counts (bottom rail
 * on phones, side rail on wide screens), notices and the list of tickets. Tickets are
 * reconciled by id so a refresh never steals focus or scroll position.
 */
import { APP_NAME } from "../shared/brand";
import { soundRunning, unlockSound, chime } from "./alerts";
import { renderTicket, ticketSignature, tickTimes } from "./cards";
import { byId, focusQuietly, h, icon, seal } from "./dom";
import { agoSeconds, clockWithSeconds, orderRef } from "./format";
import { isRefreshing, lastStatus, requestRefresh } from "./poll";
import { prefs, savePrefs } from "./prefs";
import { emit, on, state } from "./state";
import { mountAnnouncer, mountToasts, toast } from "./toast";
import type { Card, Column } from "./types";
import { COLUMNS } from "./types";

const SECTION: Record<Column, { short: string; long: string; empty: string; emptyHint: string; hint?: string }> = {
  new: {
    short: "Nuevos",
    long: "Nuevos pedidos",
    empty: "No hay pedidos nuevos",
    emptyHint: "Cuando entre uno lo verás aquí al momento.",
  },
  preparing: {
    short: "Preparación",
    long: "En preparación",
    empty: "Nada en preparación",
    emptyHint: "Los pedidos aceptados aparecen aquí con su hora de recogida.",
  },
  ready: {
    short: "Listos",
    long: "Listos para recoger",
    empty: "Ningún pedido esperando",
    emptyHint: "Los pedidos marcados como listos esperan aquí al cliente.",
  },
  completed: {
    short: "Completados",
    long: "Completados",
    empty: "Aún no se ha entregado ningún pedido hoy",
    emptyHint: "",
    hint: "Pedidos entregados hoy.",
  },
  rejected: {
    short: "Rechazados",
    long: "Rechazados",
    empty: "Hoy no se ha rechazado ningún pedido",
    emptyHint: "",
    hint: "Pedidos rechazados o cancelados hoy.",
  },
};

export function sectionName(column: Column): string {
  return SECTION[column].long;
}

type Hooks = {
  openMenu: (opener: HTMLElement) => void;
  closeDetail: () => void;
};

let hooks: Hooks;
const tabs = new Map<Column, HTMLButtonElement>();
const ticketCache = new Map<string, { el: HTMLElement; sig: string }>();
/** New orders announced while the staff member was looking at another section. */
const unseenNew = new Set<string>();

export function mountBoard(root: HTMLElement, next: Hooks): void {
  hooks = next;
  root.replaceChildren();
  const refresh = h("button", { class: "iconbtn", attrs: { id: "refresh", type: "button", "aria-label": "Actualizar ahora" } }, icon("refresh"));
  refresh.addEventListener("click", () => {
    requestRefresh();
    void maybeUnlockSound();
  });
  const menu = h(
    "button",
    { class: "iconbtn", attrs: { id: "menu", type: "button", "aria-label": "Ajustes y estado del sistema", "aria-haspopup": "dialog" } },
    icon("menu"),
  );
  menu.addEventListener("click", () => hooks.openMenu(menu));

  const top = h(
    "header",
    "top",
    h(
      "div",
      "top__brand",
      seal("seal top__seal"),
      h(
        "div",
        "top__titles",
        h("h1", { class: "top__title", text: APP_NAME }),
        h("p", { class: "top__fresh", attrs: { id: "fresh" } }, h("span", { class: "dot", attrs: { id: "fresh-dot" } }), h("span", { attrs: { id: "fresh-text" }, text: "Cargando…" })),
      ),
    ),
    h("div", "top__actions", refresh, menu),
  );

  const banners = h("div", { class: "banners", attrs: { id: "banners" } });

  const tablist = h("div", { class: "rail__tabs", attrs: { role: "tablist", "aria-label": "Pedidos por estado", "aria-orientation": "horizontal" } });
  for (const column of COLUMNS) {
    const tab = h(
      "button",
      {
        class: `tab tab--${column}`,
        attrs: { id: `tab-${column}`, type: "button", role: "tab", "aria-controls": "board", "aria-selected": "false", tabindex: "-1", "data-col": column },
      },
      h("span", { class: "tab__count", attrs: { "aria-hidden": "true" }, text: "–" }),
      h("span", "tab__label", h("span", { class: "tab__short", text: SECTION[column].short }), h("span", { class: "tab__long", text: SECTION[column].long })),
      h("span", { class: "sr-only tab__sr", text: ": cargando" }),
    );
    tab.addEventListener("click", () => selectTab(column, false));
    tab.addEventListener("keydown", (event) => onTabKey(event, column));
    tabs.set(column, tab);
    tablist.appendChild(tab);
  }

  const board = h(
    "section",
    { class: "board", attrs: { id: "board", role: "tabpanel", "aria-labelledby": "tab-new" } },
    h("div", { class: "notices", attrs: { id: "notices" } }),
    h(
      "div",
      "board__head",
      h("h2", { class: "board__title", attrs: { id: "board-title", tabindex: "-1" }, text: SECTION.new.long }),
      h("span", { class: "board__count", attrs: { id: "board-count" } }),
    ),
    h("p", { class: "board__hint", attrs: { id: "board-hint", hidden: true } }),
    h("div", { class: "list", attrs: { id: "list" } }),
  );
  const detail = h("section", { class: "detail", attrs: { id: "detail", hidden: true } });

  const app = h(
    "div",
    "app",
    h("div", "chrome", top, banners),
    h("div", "layout", h("main", { class: "main", attrs: { id: "main" } }, board, detail), h("nav", { class: "rail", attrs: { "aria-label": "Secciones" } }, tablist)),
  );
  root.appendChild(app);
  mountToasts(app);
  mountAnnouncer(app);

  on("board", renderAll);
  on("pending", renderList);
  on("tab", renderAll);
  on("prefs", renderNotices);
  on("sound", renderNotices);
  on("connection", renderConnection);
  on("route", renderBanners);
  selectTab(state.tab, false, true);
  renderAll();
}

function onTabKey(event: KeyboardEvent, column: Column): void {
  const index = COLUMNS.indexOf(column);
  let next: number | null = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % COLUMNS.length;
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + COLUMNS.length) % COLUMNS.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = COLUMNS.length - 1;
  if (next === null) return;
  event.preventDefault();
  selectTab(COLUMNS[next], true);
}

export function selectTab(column: Column, moveFocus: boolean, silent = false): void {
  const changed = state.tab !== column;
  state.tab = column;
  for (const [col, tab] of tabs) {
    const selected = col === column;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  byId("board").setAttribute("aria-labelledby", `tab-${column}`);
  if (moveFocus) focusQuietly(tabs.get(column));
  if (column === "new") unseenNew.clear();
  if (state.detailId) hooks.closeDetail();
  if (changed && !silent) {
    window.scrollTo({ top: 0 });
    emit("tab");
  }
}

function renderAll(): void {
  renderTabs();
  renderNotices();
  renderList();
  renderBanners();
}

function renderTabs(): void {
  const board = state.board;
  for (const [column, tab] of tabs) {
    const count = board ? board.columns[column].length : null;
    const countEl = tab.querySelector(".tab__count");
    if (countEl) countEl.textContent = count === null ? "–" : String(count);
    const srEl = tab.querySelector(".tab__sr");
    if (srEl) srEl.textContent = count === null ? ": cargando" : `: ${count}`;
    tab.toggleAttribute("data-hot", column === "new" && (count ?? 0) > 0);
  }
}

async function maybeUnlockSound(): Promise<void> {
  if (prefs.sound && !soundRunning()) {
    if (await unlockSound()) emit("sound");
  }
}

function notice(className: string, iconName: Parameters<typeof icon>[0], text: string, action?: HTMLElement): HTMLElement {
  return h("div", `notice ${className}`, icon(iconName, "ico notice__ico"), h("p", { class: "notice__text", text }), action ?? null);
}

function renderNotices(): void {
  const box = byId("notices");
  const items: HTMLElement[] = [];
  const mode = state.board?.paymentsMode;
  if (mode === "stripe-test") {
    items.push(
      h("div", "notice notice--test", h("span", { class: "badge badge--test", text: "PRUEBA" }), h("p", { class: "notice__text", text: "No se cobra dinero real." })),
    );
  } else if (mode === "disabled") {
    items.push(notice("notice--danger", "warning", "Pagos desactivados: ahora no se pueden cobrar pedidos. Revisa la configuración de Stripe."));
  }
  if (!prefs.sound || !soundRunning()) {
    const turnOn = h("button", { class: "btn btn--ink btn--small", attrs: { type: "button" }, text: prefs.sound ? "Reactivar" : "Activar sonido" });
    turnOn.addEventListener("click", async () => {
      const ok = await unlockSound();
      if (!ok) {
        toast("error", "No se ha podido activar el sonido", "Este navegador no permite reproducir sonido.");
        return;
      }
      savePrefs({ sound: true });
      chime();
      toast("ok", "Sonido activado", "Así sonará cada pedido nuevo.");
      emit("prefs");
    });
    items.push(
      notice(
        "notice--sound",
        "soundOff",
        prefs.sound ? "Sonido en pausa: toca para reactivarlo." : "Activa el sonido para oír los pedidos nuevos.",
        turnOn,
      ),
    );
  }
  box.replaceChildren(...items);
}

function emptyState(column: Column): HTMLElement {
  const info = SECTION[column];
  return h(
    "div",
    "empty",
    icon(column === "new" ? "bell" : column === "rejected" ? "close" : "check", "ico empty__ico"),
    h("p", { class: "empty__title", text: info.empty }),
    info.emptyHint ? h("p", { class: "empty__text", text: info.emptyHint }) : null,
  );
}

function renderList(): void {
  const column = state.tab;
  const list = byId("list");
  const title = byId("board-title");
  const info = SECTION[column];
  if (title.textContent !== info.long) title.textContent = info.long;
  const hint = byId("board-hint");
  hint.hidden = !info.hint;
  hint.textContent = info.hint ?? "";

  const board = state.board;
  const countEl = byId("board-count");
  if (!board) {
    countEl.textContent = "";
    list.replaceChildren(h("p", { class: "loading", text: "Cargando pedidos…" }));
    ticketCache.clear();
    return;
  }
  const cards: Card[] = board.columns[column];
  countEl.textContent = String(cards.length);
  if (!cards.length) {
    ticketCache.clear();
    list.replaceChildren(emptyState(column));
    return;
  }
  list.querySelector(".empty, .loading")?.remove();

  const hadFocus = list.contains(document.activeElement) ? (document.activeElement as HTMLElement) : null;
  const focusKey = hadFocus?.dataset.focus ?? null;
  const focusOrder = hadFocus?.closest<HTMLElement>(".tk")?.dataset.id ?? null;

  const desired: HTMLElement[] = [];
  const keep = new Set<string>();
  for (const card of cards) {
    const sig = ticketSignature(card);
    let entry = ticketCache.get(card.id);
    if (!entry || entry.sig !== sig) {
      const el = renderTicket(card, "board");
      if (entry) entry.el.replaceWith(el);
      entry = { el, sig };
      ticketCache.set(card.id, entry);
    }
    desired.push(entry.el);
    keep.add(card.id);
  }
  for (const [id, entry] of ticketCache) {
    if (!keep.has(id)) {
      entry.el.remove();
      ticketCache.delete(id);
    }
  }
  let ref = list.firstElementChild;
  for (const el of desired) {
    if (el === ref) {
      ref = ref.nextElementSibling;
      continue;
    }
    list.insertBefore(el, ref);
  }
  // A re-rendered ticket keeps keyboard focus on the equivalent control.
  if (hadFocus && !hadFocus.isConnected) {
    const ticket = focusOrder ? ticketCache.get(focusOrder)?.el : null;
    const target =
      (ticket && focusKey ? ticket.querySelector<HTMLElement>(`[data-focus="${CSS.escape(focusKey)}"]`) : null) ??
      ticket?.querySelector<HTMLElement>('[data-focus="link"]') ??
      title;
    focusQuietly(target);
  }
  tickTimes(list, Date.now() + state.offset);
}

// ---------------------------------------------------------------------------
// Banners: connection problems and new orders arriving while elsewhere
// ---------------------------------------------------------------------------

export function noteNewOrders(cards: Card[]): void {
  for (const card of cards) unseenNew.add(card.id);
  if (state.tab === "new" && !state.detailId) unseenNew.clear();
  renderBanners();
}

function renderBanners(): void {
  const box = byId("banners");
  const items: HTMLElement[] = [];
  const conn = connectionBanner();
  if (conn) items.push(conn);
  const stillNew = [...unseenNew].filter((id) => state.board?.columns.new.some((c) => c.id === id));
  if (stillNew.length && (state.tab !== "new" || state.detailId)) {
    const first = state.board?.columns.new.find((c) => c.id === stillNew[0]);
    const label = stillNew.length === 1 && first ? `Nuevo pedido ${orderRef(first)}` : `${stillNew.length} pedidos nuevos`;
    const bar = h("button", { class: "newbar", attrs: { type: "button" } }, icon("bell"), h("span", { class: "newbar__text", text: label }), h("span", { class: "newbar__go", text: "Ver" }));
    bar.addEventListener("click", () => {
      unseenNew.clear();
      selectTab("new", false);
      if (state.detailId) hooks.closeDetail();
      renderBanners();
      focusQuietly(byId("board-title"));
    });
    items.push(bar);
  }
  box.replaceChildren(...items);
}

/** Connection trouble worth a banner: offline, repeated failures or data older than 20 s. */
function connectionProblem(): boolean {
  const stale = state.boardAt > 0 && Date.now() - state.boardAt > 20_000 && document.visibilityState === "visible";
  return state.connection === "offline" || (state.connection === "retrying" && state.failures >= 2) || stale;
}

function connectionBanner(): HTMLElement | null {
  if (!connectionProblem()) return null;
  const offline = state.connection === "offline" || navigator.onLine === false;
  const title = offline
    ? "Sin conexión — reintentando"
    : lastStatus >= 500
      ? "El servidor no responde — reintentando"
      : "No se pueden cargar los pedidos — reintentando";
  const since = state.boardAt ? `Los datos son de las ${clockWithSeconds(state.boardAt + state.offset)} (${agoSeconds(state.boardAt, Date.now())}).` : "Todavía no se ha podido cargar ningún pedido.";
  const retry = h("button", { class: "btn btn--small btn--on-dark", attrs: { type: "button" }, text: "Reintentar" });
  retry.addEventListener("click", () => requestRefresh());
  return h(
    "div",
    { class: "banner banner--offline", attrs: { role: "status" } },
    icon("offline", "ico banner__ico"),
    h("div", "banner__text", h("p", { class: "banner__title", text: title }), h("p", { class: "banner__sub", attrs: { "data-stale": "" }, text: since })),
    retry,
  );
}

let lastConnectionKey = "";
function renderConnection(): void {
  const key = `${state.connection}|${state.failures >= 2}`;
  if (key !== lastConnectionKey) {
    lastConnectionKey = key;
    renderBanners();
  }
  updateFreshness();
}

/** Header line "Actualizado hace 5 s" + the stale/offline banner text, once a second. */
export function updateFreshness(): void {
  const text = document.getElementById("fresh-text");
  const dot = document.getElementById("fresh-dot");
  if (!text || !dot) return;
  const refresh = document.getElementById("refresh");
  refresh?.classList.toggle("is-busy", isRefreshing());
  const now = Date.now();
  let value: string;
  let tone: "ok" | "warn" | "bad";
  if (!state.boardAt) {
    value = state.connection === "ok" ? "Cargando…" : "Sin conexión";
    tone = state.connection === "ok" ? "warn" : "bad";
  } else if (state.connection === "offline") {
    value = `Sin conexión · datos de ${agoSeconds(state.boardAt, now)}`;
    tone = "bad";
  } else if (state.connection === "retrying") {
    value = `Reintentando · datos de ${agoSeconds(state.boardAt, now)}`;
    tone = state.failures >= 2 ? "bad" : "warn";
  } else {
    value = `Actualizado ${agoSeconds(state.boardAt, now)}`;
    tone = now - state.boardAt > 20_000 ? "warn" : "ok";
  }
  if (text.textContent !== value) text.textContent = value;
  dot.className = `dot dot--${tone}`;
  const stale = document.querySelector<HTMLElement>("[data-stale]");
  if (stale && state.boardAt) stale.textContent = `Los datos son de las ${clockWithSeconds(state.boardAt + state.offset)} (${agoSeconds(state.boardAt, now)}).`;
  if (connectionProblem() !== Boolean(document.querySelector(".banner--offline"))) renderBanners();
}
