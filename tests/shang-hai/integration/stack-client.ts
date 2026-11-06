/**
 * Drives a running local stack (scripts/local-stack/harness.mjs) over HTTP exactly as the
 * storefront, the customer's browser on the payment page and the staff phone do, and reads
 * the truth back from the local D1 and the fake Stripe. Level B: real Worker + real local D1
 * (workerd), simulated Stripe and Telegram. No real money, no external accounts.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { queryD1 } from "../../../scripts/db/schema.mjs";
import { createStack } from "../../../scripts/local-stack/harness.mjs";

export type Stack = ReturnType<typeof createStack>;

/**
 * fetch() that retries once when Node's HTTP client reused a keep-alive connection the local
 * dev server had already closed (the request never left: "other side closed" with no answer).
 * Browsers do the same transparently. Safe for staff actions too: they are conditional on the
 * order's state on the server, so a duplicate can only get 409.
 */
export async function http(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    const cause = (error as { cause?: { code?: string } }).cause;
    if (cause?.code !== "UND_ERR_SOCKET") throw error;
    return fetch(url, init);
  }
}

export function tempStateDir(name: string): string {
  return mkdtempSync(join(tmpdir(), `shanghai-${name}-`));
}

/** Ports per suite so suites never collide with each other or with a running demo. */
export function suiteStack(name: string, base: number, workerVars: Record<string, string> = {}): Stack {
  return createStack({
    stateDir: tempStateDir(name),
    ports: { worker: base, cloud: base + 3, site: base + 6 },
    quiet: !process.env.STACK_LOGS,
    label: `${name}:`,
    workerVars: {
      ACCEPTANCE_REMINDER_MINUTES: "0",
      ACCEPTANCE_TIMEOUT_MINUTES: "0",
      // Lock TTL = max(stale, 4 × Stripe timeout + 10 s) = 18 s: recovery is quick to observe.
      LOCK_STALE_SECONDS: "5",
      LOCK_REVIEW_SECONDS: "20",
      STRIPE_TIMEOUT_MS: "2000",
      ...workerVars,
    },
  });
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Polls until `check` returns a truthy value (no fixed sleeps in assertions). */
export async function eventually<T>(check: () => Promise<T | null | undefined | false>, what: string, timeoutMs = 20_000): Promise<T> {
  const until = Date.now() + timeoutMs;
  let last: unknown = null;
  while (Date.now() < until) {
    try {
      const value = await check();
      if (value) return value;
      last = value;
    } catch (error) {
      last = error;
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${what} (last: ${last instanceof Error ? last.message : JSON.stringify(last)})`);
}

export type Placed = { orderId: string; orderNumber: number; orderToken: string; checkoutUrl: string; sessionId: string; totalCents: number };

export const LINES = [
  { itemId: "combo-a", quantity: 2 },
  { itemId: "pollo-con-almendras", quantity: 1 },
];
export const LINES_TOTAL = 2 * 1945 + 765;

/** `ip`: the customer's address as Cloudflare reports it (rate limits are per address). */
export async function checkout(stack: Stack, overrides: Record<string, unknown> = {}, ip?: string): Promise<Placed> {
  const body = {
    catalogId: "shang-hai-orihuela",
    storefront: "ink-house",
    fulfillment: "pickup",
    locale: "es",
    lines: LINES,
    customer: { name: "Lucía García", phone: "612 345 678", email: "lucia@example.es", notes: "" },
    expectedTotalCents: LINES_TOTAL,
    ...overrides,
  };
  const res = await http(`${stack.urls.worker}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: stack.urls.site, ...(ip ? { "CF-Connecting-IP": ip } : {}) },
    body: JSON.stringify(body),
  });
  if (res.status !== 201) throw new Error(`checkout failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as Omit<Placed, "sessionId" | "totalCents">;
  return { ...json, sessionId: /cs_test_[A-Za-z0-9]+/.exec(json.checkoutUrl)?.[0] ?? "", totalCents: Number(body.expectedTotalCents) };
}

/** The customer presses "authorise" (or "decline") on the hosted payment page. */
export async function payOnPage(stack: Stack, sessionId: string, outcome: "authorize" | "decline" = "authorize") {
  const res = await http(`${stack.urls.cloud}/pay/${sessionId}/${outcome}`, { method: "POST", redirect: "manual" });
  return res.status;
}

export async function customerView(stack: Stack, order: Pick<Placed, "orderId" | "orderToken">, ip?: string) {
  const res = await http(`${stack.urls.worker}/api/orders/${order.orderId}`, {
    headers: { Authorization: `Bearer ${order.orderToken}`, Origin: stack.urls.site, ...(ip ? { "CF-Connecting-IP": ip } : {}) },
  });
  if (!res.ok) throw new Error(`customer view ${res.status}`);
  return ((await res.json()) as { order: Record<string, unknown> }).order;
}

export async function cloudState(stack: Stack) {
  return (await (await http(`${stack.urls.cloud}/__control/state`)).json()) as {
    intents: { id: string; status: string; order: string; amount: number; amountReceived: number; amountCapturable: number }[];
    charges: { id: string; pi: string; captured: boolean; amountCaptured: number; amountRefunded: number }[];
    refunds: { id: string; status: string; amount: number; pi: string }[];
    calls: { method: string; path: string; key: string | null }[];
    sessionIds: string[];
    queuedWebhooks: number;
    webhooks: { id: string; type: string; status: number }[];
    telegram: { chat_id: string; text: string; button: { url: string } | null }[];
    whatsapp: { id: string; to: string; template: string; params: string[]; text: string; button: { text: string; url: string | null; copy: string | null } | null }[];
  };
}

export async function control(stack: Stack, path: string, body: unknown = {}) {
  const res = await http(`${stack.urls.cloud}/__control/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`control ${path}: ${res.status}`);
  return res.json();
}

/**
 * Rows straight from the local D1 (wrangler d1 execute, same files the Worker uses). It is a
 * second process on the same SQLite file: use it when the Worker is not in the middle of a
 * burst of writes (workerd answers SQLITE_BUSY otherwise — a local-only effect).
 */
export function d1(stack: Stack, sql: string): Record<string, unknown>[] {
  return queryD1(sql, { persistTo: stack.stateDir }) as Record<string, unknown>[];
}

export function orderRow(stack: Stack, id: string) {
  return d1(stack, `SELECT * FROM orders WHERE id = '${id.replace(/'/g, "")}'`)[0];
}

// ---------------------------------------------------------------------------
// Staff phone
// ---------------------------------------------------------------------------

/** Signs a staff phone in with the Telegram code flow; the session lives in D1 (survives restarts). */
export async function staffSignIn(stack: Stack, label = "Móvil de cocina"): Promise<string> {
  const headers = { "Content-Type": "application/json", Origin: stack.urls.worker };
  const before = (await cloudState(stack)).telegram.length;
  const asked = await http(`${stack.urls.worker}/api/admin/auth/code`, { method: "POST", headers, body: "{}" });
  if (asked.status !== 200 && asked.status !== 202) throw new Error(`code request ${asked.status} ${await asked.text()}`);
  const code = await eventually(async () => {
    const msgs = (await cloudState(stack)).telegram.slice(before);
    const m = msgs.map((x) => /\b(\d{3})\s?(\d{3})\b/.exec(x.text)).find(Boolean);
    return m ? `${m[1]}${m[2]}` : null;
  }, "sign-in code on the staff phone");
  const verified = await http(`${stack.urls.worker}/api/admin/auth/verify`, { method: "POST", headers, body: JSON.stringify({ code, label }) });
  if (verified.status !== 200) throw new Error(`verify ${verified.status} ${await verified.text()}`);
  const cookie = /(__Host-shp_session=[^;]+)/.exec(verified.headers.get("set-cookie") ?? "")?.[1];
  if (!cookie) throw new Error("no session cookie");
  return cookie;
}

export async function staff(stack: Stack, cookie: string, path: string, body?: unknown) {
  const res = await http(`${stack.urls.worker}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Cookie: cookie, Origin: stack.urls.worker, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> & { order?: Record<string, unknown> } };
}

export const accept = (stack: Stack, cookie: string, id: string, prepMinutes = 20) => staff(stack, cookie, `/api/admin/orders/${id}/accept`, { prepMinutes });
export const reject = (stack: Stack, cookie: string, id: string, reason = "") => staff(stack, cookie, `/api/admin/orders/${id}/reject`, { reason });

/** An order that reached the restaurant (paid on the page, webhook processed). */
export async function placedOrder(stack: Stack, overrides: Record<string, unknown> = {}): Promise<Placed> {
  const order = await checkout(stack, overrides);
  expectStatus(await payOnPage(stack, order.sessionId), [303]);
  await eventually(async () => (await customerView(stack, order)).status === "awaiting_acceptance", `order ${order.orderNumber} awaiting acceptance`);
  return order;
}

function expectStatus(status: number, allowed: number[]) {
  if (!allowed.includes(status)) throw new Error(`unexpected status ${status}`);
}
