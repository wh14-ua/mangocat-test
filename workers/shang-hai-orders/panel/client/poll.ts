/**
 * Keeps the board fresh: every 5 s while the panel is visible, every 30 s in the
 * background, at once when the phone comes back online or the panel is shown again.
 * Failures back off up to 20 s and are surfaced (never stale data in silence).
 */
import { api } from "./api";
import { emit, state } from "./state";
import type { Board, LoginMethod } from "./types";

const VISIBLE_MS = 5_000;
const HIDDEN_MS = 30_000;
const MAX_BACKOFF_MS = 20_000;

type Hooks = {
  onBoard: (board: Board) => void;
  onUnauthorized: (login: LoginMethod[] | undefined) => void;
};

let hooks: Hooks = { onBoard: () => undefined, onUnauthorized: () => undefined };
let timer = 0;
let running = false;
let inflight = false;
let again = false;
export let lastStatus = 0;

export function configurePolling(next: Hooks): void {
  hooks = next;
}

export function isRefreshing(): boolean {
  return inflight;
}

export function startPolling(): void {
  if (running) return;
  running = true;
  void refresh();
}

export function stopPolling(): void {
  running = false;
  window.clearTimeout(timer);
}

/** Refresh now (or right after the request already in flight). */
export function requestRefresh(): void {
  if (!running) return;
  if (inflight) {
    again = true;
    return;
  }
  window.clearTimeout(timer);
  void refresh();
}

function nextDelay(): number {
  if (document.visibilityState === "hidden") return HIDDEN_MS;
  if (state.failures === 0) return VISIBLE_MS;
  return Math.min(VISIBLE_MS * 2 ** (state.failures - 1), MAX_BACKOFF_MS);
}

async function refresh(): Promise<void> {
  inflight = true;
  emit("connection");
  const mutationsAtStart = state.mutations;
  const sentAt = Date.now();
  const res = await api.board();
  const receivedAt = Date.now();
  inflight = false;
  if (!running) return;
  lastStatus = res.status;

  if (res.ok) {
    if (state.mutations !== mutationsAtStart) {
      // An action finished while this request was in flight: its answer may predate it.
      again = true;
    } else {
      const serverMs = Date.parse(res.data.now);
      if (Number.isFinite(serverMs)) state.offset = Math.round(serverMs - (sentAt + receivedAt) / 2);
      state.failures = 0;
      state.connection = "ok";
      state.boardAt = receivedAt;
      hooks.onBoard(res.data);
    }
  } else if (res.status === 401) {
    stopPolling();
    hooks.onUnauthorized(res.data?.login);
    return;
  } else {
    state.failures += 1;
    state.connection = res.network && navigator.onLine === false ? "offline" : "retrying";
  }
  emit("connection");
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void refresh(), again ? 0 : nextDelay());
  again = false;
}

export function wirePollingTriggers(): void {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") requestRefresh();
  });
  window.addEventListener("online", () => {
    state.connection = state.failures ? "retrying" : "ok";
    emit("connection");
    requestRefresh();
  });
  window.addEventListener("offline", () => {
    state.connection = "offline";
    emit("connection");
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) requestRefresh();
  });
}
