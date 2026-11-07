/** Same-origin JSON calls to the staff API (session cookie, CSRF-safe JSON bodies). */
import type { ActionReply, Board, Card, LoginMethod, OrderDetail, Session, StaffAction } from "./types";

export type ApiErrorBody = {
  error?: string;
  message?: string;
  login?: LoginMethod[];
  order?: Card | null;
};

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; data: ApiErrorBody | null; network: boolean; timedOut: boolean };

async function request<T>(method: "GET" | "POST", path: string, body?: unknown, timeoutMs = 12_000): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const init: RequestInit = {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: method === "POST" ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
      signal: controller.signal,
    };
    if (method === "POST") init.body = JSON.stringify(body ?? {});
    const res = await fetch(path, init);
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (res.ok) return { ok: true, status: res.status, data: data as T };
    const errorBody = data && typeof data === "object" ? (data as ApiErrorBody) : null;
    return { ok: false, status: res.status, data: errorBody, network: false, timedOut: false };
  } catch {
    return { ok: false, status: 0, data: null, network: true, timedOut: controller.signal.aborted };
  } finally {
    window.clearTimeout(timer);
  }
}

const enc = encodeURIComponent;

export const api = {
  session: () => request<Session>("GET", "/api/admin/session"),
  board: () => request<Board>("GET", "/api/admin/board", undefined, 10_000),
  order: (id: string) => request<{ order: OrderDetail }>("GET", `/api/admin/orders/${enc(id)}`),
  /** Stripe may take a while: actions wait longer than reads. */
  action: (id: string, action: StaffAction, body: Record<string, unknown> = {}) =>
    request<ActionReply>("POST", `/api/admin/orders/${enc(id)}/${action}`, body, 30_000),
  // The code may wait a few seconds for its WhatsApp turn (an order alert just went to the phone).
  sendCode: () => request<{ sent: number; expiresInSeconds: number }>("POST", "/api/admin/auth/code", {}, 25_000),
  verify: (code: string, label: string) =>
    request<{ ok: true; label: string }>("POST", "/api/admin/auth/verify", label ? { code, label } : { code }),
  logout: (everywhere: boolean) =>
    request<{ ok: true; everywhere: boolean }>("POST", "/api/admin/auth/logout", everywhere ? { everywhere: true } : {}),
};
