/**
 * SHANG HAI — PEDIDOS, staff panel entry point.
 * Boot: who am I? -> sign-in (401) | closed (503) | board. Then poll, route #pedido=<id>,
 * alert on new orders and tick the clocks once a second.
 */
import { installActionHandler, setUnauthorizedHandler } from "./actions";
import { chime, notificationsOn, setTitleCount, showNotification, soundRunning, syncWakeLock, unlockSound, vibrate } from "./alerts";
import { api } from "./api";
import { mountBoard, noteNewOrders, updateFreshness } from "./board";
import { tickTimes } from "./cards";
import { closeDetail, initDetail, openDetail } from "./detail";
import { byId } from "./dom";
import { euros, itemsText, orderRef } from "./format";
import { configurePolling, startPolling, stopPolling, wirePollingTriggers } from "./poll";
import { prefs } from "./prefs";
import { emit, serverNow, state } from "./state";
import { showClosed, showSignIn, showUnreachable } from "./signin";
import { openSystemSheet } from "./system";
import { announce } from "./toast";
import type { Board, Card, LoginMethod } from "./types";

const root = byId("app");
let started = false;

// ---------------------------------------------------------------------------
// New orders
// ---------------------------------------------------------------------------

const known = new Set<string>();
let primed = false;

function newArrivals(board: Board): Card[] {
  const waiting = board.columns.new.filter((c) => c.status === "awaiting_acceptance" || c.status === "needs_review");
  const fresh = primed ? waiting.filter((c) => !known.has(c.id)) : [];
  for (const card of board.columns.new) known.add(card.id);
  primed = true;
  return fresh;
}

function alertArrivals(cards: Card[]): void {
  if (!cards.length) return;
  const first = cards[0];
  const label =
    cards.length > 1
      ? `${cards.length} pedidos nuevos`
      : first.status === "needs_review"
        ? `Pedido ${orderRef(first)} en revisión`
        : `Nuevo pedido ${orderRef(first)}`;
  if (prefs.sound) chime();
  vibrate();
  announce(label);
  noteNewOrders(cards);
  if (document.visibilityState === "hidden" && notificationsOn()) {
    for (const card of cards.slice(0, 3)) {
      showNotification(
        card.status === "needs_review" ? `Pedido ${orderRef(card)} en revisión` : `Nuevo pedido ${orderRef(card)}`,
        `${itemsText(card.itemCount)} · ${euros(card.totalCents)} · ${card.fulfillment === "pickup" ? "Recogida" : "Reparto"}`,
        `pedido-${card.id}`,
        () => goToOrder(card.id),
      );
    }
  }
}

function applyBoard(board: Board): void {
  const arrivals = newArrivals(board);
  state.board = board;
  emit("board");
  setTitleCount(board.columns.new.length);
  alertArrivals(arrivals);
}

// ---------------------------------------------------------------------------
// Routing: #pedido=<id>
// ---------------------------------------------------------------------------

function hashOrderId(): string | null {
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return null;
  return new URLSearchParams(raw).get("pedido");
}

function route(): void {
  if (!started) return;
  const id = hashOrderId();
  if (id) {
    if (state.detailId !== id) openDetail(id, false);
  } else if (state.detailId) {
    closeDetail();
  }
}

function goToOrder(id: string): void {
  history.pushState({ detail: id }, "", `#pedido=${encodeURIComponent(id)}`);
  openDetail(id, true);
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

function signedOut(notice: string, login?: LoginMethod[]): void {
  stopPolling();
  for (const dialog of document.querySelectorAll("dialog")) dialog.close();
  const methods = login ?? state.session?.loginMethods ?? ["telegram"];
  state.session = null;
  state.board = null;
  setTitleCount(0);
  // A fresh page after signing in again: no leftovers from the previous session.
  showSignIn(root, { login: methods, notice, onSignedIn: () => window.location.reload() });
}

let retryTimer = 0;

async function boot(): Promise<void> {
  window.clearTimeout(retryTimer);
  const res = await api.session();
  if (res.ok) {
    state.session = res.data;
    startApp();
    return;
  }
  if (res.status === 401) {
    showSignIn(root, { login: res.data?.login ?? ["telegram"], onSignedIn: () => window.location.reload() });
    return;
  }
  if (res.status === 503 && res.data?.error === "admin-not-configured") {
    showClosed(root);
    return;
  }
  showUnreachable(root, () => void boot(), res.network && navigator.onLine === false);
  retryTimer = window.setTimeout(() => void boot(), 5_000);
}

function startApp(): void {
  if (started) return;
  started = true;
  installActionHandler();
  setUnauthorizedHandler(() => signedOut("Tu sesión ha caducado. Vuelve a entrar."));
  initDetail({ onUnauthorized: () => signedOut("Tu sesión ha caducado. Vuelve a entrar.") });
  mountBoard(root, {
    openMenu: () => openSystemSheet((notice) => signedOut(notice)),
    closeDetail,
  });
  configurePolling({
    onBoard: applyBoard,
    onUnauthorized: (login) => signedOut("Tu sesión ha caducado. Vuelve a entrar.", login),
  });
  wirePollingTriggers();
  startPolling();
  route();
  void syncWakeLock();

  window.setInterval(() => {
    updateFreshness();
    tickTimes(document, serverNow());
  }, 1000);
}

// ---------------------------------------------------------------------------
// Global wiring
// ---------------------------------------------------------------------------

window.addEventListener("popstate", route);
window.addEventListener("hashchange", route);

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const link = target?.closest<HTMLAnchorElement>("a.tk__link");
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const id = link.closest<HTMLElement>(".tk")?.dataset.id;
  if (!id) return;
  event.preventDefault();
  goToOrder(id);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.detailId && !document.querySelector("dialog[open]")) closeDetail();
});

// Browsers only allow sound after a tap: the first tap re-arms the chime if it was on.
const rearmSound = () => {
  if (!prefs.sound || soundRunning()) return;
  void unlockSound().then((ok) => {
    if (ok) emit("sound");
  });
};
document.addEventListener("pointerdown", rearmSound, { capture: true });
document.addEventListener("keydown", rearmSound, { capture: true });

document.addEventListener("visibilitychange", () => void syncWakeLock());

void boot();
