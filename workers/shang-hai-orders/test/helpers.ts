import { handleRequest } from "../src/index";
import { base64UrlEncode, hmacSha256Hex, newOrderToken, sha256Hex } from "../src/crypto";
import { runScheduled } from "../src/cron";
import type { Deps, Env, RateLimiterLike } from "../src/env";
import { createTestD1 } from "./d1-sqlite";
// Shared with the local end-to-end stack (scripts/local-stack/).
import { createFakeStripe } from "../../../scripts/local-stack/fake-stripe.mjs";
import { createFakeTelegram } from "../../../scripts/local-stack/fake-telegram.mjs";
import { createFakeWhatsApp, signMeta } from "../../../scripts/local-stack/fake-whatsapp.mjs";

export const TEST_SECRET_KEY = "sk_test_51FakeKeyForUnitTestsOnly";
export const WEBHOOK_SECRET = "whsec_unit_test_secret";
export const TELEGRAM_TOKEN = "123456789:AAFakeTokenForUnitTestsOnly_abcdef";
export const STAFF_CHATS = ["111111111", "-1002222222222"];
export const WHATSAPP_TOKEN = "EAAfake-whatsapp-token-for-tests-only-0000000000";
export const WHATSAPP_APP_SECRET = "fake-meta-app-secret-for-tests";
export const WHATSAPP_VERIFY_TOKEN = "verify-token-for-tests";
export const OWNER_WHATSAPP = "34612000111";
/** WhatsApp as the alert channel (Telegram off): the commercial configuration. */
export const WHATSAPP_ENV = {
  WHATSAPP_ACCESS_TOKEN: WHATSAPP_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID: "100000000000001",
  WHATSAPP_RECIPIENTS: `+${OWNER_WHATSAPP}`,
  WHATSAPP_APP_SECRET: WHATSAPP_APP_SECRET,
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: WHATSAPP_VERIFY_TOKEN,
  TELEGRAM_BOT_TOKEN: "",
  TELEGRAM_CHAT_IDS: "",
};
export const STOREFRONT_ORIGIN = "https://wh14-ua.github.io";
export const WORKER_ORIGIN = "https://orders.example.workers.dev";
export const PANEL = `${WORKER_ORIGIN}/admin`;
export const NOW = new Date("2026-10-29T12:00:00Z");
export const TEAM_DOMAIN = "mangocat.cloudflareaccess.com";
export const ACCESS_AUD = "aud-shang-hai-orders-test";

export type TestEnv = Env & { DB: ReturnType<typeof createTestD1> };

export function makeEnv(overrides: Partial<Env> = {}): TestEnv {
  return {
    DB: createTestD1(),
    STRIPE_SECRET_KEY: TEST_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    STRIPE_TEST_MODE: "true",
    CORS_ALLOWED_ORIGIN: `${STOREFRONT_ORIGIN},http://localhost:3000`,
    TELEGRAM_BOT_TOKEN: TELEGRAM_TOKEN,
    TELEGRAM_CHAT_IDS: STAFF_CHATS.join(","),
    PANEL_URL: PANEL,
    ...overrides,
  } as TestEnv;
}

export type StripeCall = { url: string; method: string; headers: Headers; form: URLSearchParams };

type FakeStripe = ReturnType<typeof createFakeStripe>;
type FakeTelegram = ReturnType<typeof createFakeTelegram>;
type FakeWhatsApp = ReturnType<typeof createFakeWhatsApp>;

/**
 * Fake network: a stateful Stripe emulator, a Telegram recorder and an optional
 * Cloudflare Access JWKS endpoint. Any other outbound request fails the test.
 */
export function fakeNetwork(
  options: {
    stripe?: "ok" | "error" | "bad-url";
    jwks?: JsonWebKey[];
    fakeStripe?: FakeStripe;
    fakeTelegram?: FakeTelegram;
    fakeWhatsApp?: FakeWhatsApp;
  } = {},
) {
  const stripe: FakeStripe =
    options.fakeStripe ??
    createFakeStripe(options.stripe === "bad-url" ? { hostedBase: "https://evil.example/pay" } : {});
  if (options.stripe === "error") stripe.failNext({ method: "POST", path: /^\/v1\/checkout\/sessions$/, status: 500, times: 99 });
  const telegram: FakeTelegram = options.fakeTelegram ?? createFakeTelegram();
  const whatsapp: FakeWhatsApp = options.fakeWhatsApp ?? createFakeWhatsApp({ pairIntervalMs: 0, panelUrl: PANEL });
  const stripeFetch = stripe.fetchFor();
  const telegramFetch = telegram.fetchFor();
  const whatsappFetch = whatsapp.fetchFor();
  const stripeCalls: StripeCall[] = [];
  let jwksRequests = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("https://api.stripe.com/v1/")) {
      const method = init?.method ?? "GET";
      stripeCalls.push({
        url,
        method,
        headers: new Headers(init?.headers),
        form: method === "POST" ? new URLSearchParams(String(init?.body ?? "")) : new URL(url).searchParams,
      });
      return stripeFetch(url, init);
    }
    if (url.startsWith("https://api.telegram.org/")) return telegramFetch(url, init);
    if (url.startsWith("https://graph.facebook.com/")) return whatsappFetch(url, init);
    if (url === `https://${TEAM_DOMAIN}/cdn-cgi/access/certs`) {
      jwksRequests += 1;
      return Response.json({ keys: options.jwks ?? [] });
    }
    throw new Error(`Unexpected outbound request to ${url}`);
  };
  return { fetch: fetchImpl, stripeCalls, jwksRequests: () => jwksRequests, stripe, telegram, whatsapp };
}

export type TestDeps = Deps & { flush: () => Promise<void> };

/**
 * Deps whose waitUntil work can be awaited with flush() (notifications sent "in background").
 * sleep() never really waits: a world moves its clock forward instead (a fixed clock stays put).
 */
export function makeDeps(fetchImpl: typeof fetch, now: Date | (() => Date) = NOW, sleep: (ms: number) => Promise<void> = async () => undefined): TestDeps {
  const pending: Promise<unknown>[] = [];
  return {
    fetch: fetchImpl,
    now: typeof now === "function" ? now : () => now,
    jwksCache: new Map(),
    waitUntil: (p) => {
      pending.push(p.catch(() => undefined));
    },
    sleep,
    async flush() {
      while (pending.length) await Promise.all(pending.splice(0, pending.length));
    },
  };
}

export function call(env: Env, deps: Deps, path: string, init: RequestInit = {}): Promise<Response> {
  return handleRequest(new Request(`${WORKER_ORIGIN}${path}`, init), env, deps);
}

export function validCheckout(overrides: Record<string, unknown> = {}) {
  return {
    catalogId: "shang-hai-orihuela",
    storefront: "ink-house",
    fulfillment: "pickup",
    lines: [
      { itemId: "combo-a", quantity: 2 },
      { itemId: "pollo-con-almendras", quantity: 1 },
    ],
    customer: { name: "Lucía García", phone: "612 345 678", email: "lucia@example.es", notes: "Sin cebolla" },
    expectedTotalCents: 2 * 1945 + 765,
    ...overrides,
  };
}

export const CHECKOUT_TOTAL = 2 * 1945 + 765;

export function postJson(env: Env, deps: Deps, path: string, body: unknown, headers: Record<string, string> = {}) {
  return call(env, deps, path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: STOREFRONT_ORIGIN, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** A test world: env + one fake network shared by every call, with a movable clock. */
export function world(envOverrides: Partial<Env> = {}, start: Date = NOW) {
  const env = makeEnv(envOverrides);
  let clock = start.getTime();
  // The fake WhatsApp follows the same movable clock (its pair rate limit is time based).
  const net = fakeNetwork({ fakeWhatsApp: createFakeWhatsApp({ pairIntervalMs: 0, panelUrl: PANEL, now: () => clock }) });
  // Waiting moves time on (concurrent waits overlap: the clock goes to the latest end, not the sum).
  const deps = makeDeps(net.fetch, () => new Date(clock), async (ms) => {
    const until = clock + ms;
    await Promise.resolve();
    clock = Math.max(clock, until);
  });
  return {
    env,
    net,
    deps,
    stripe: net.stripe,
    telegram: net.telegram,
    whatsapp: net.whatsapp,
    advance(ms: number) {
      clock += ms;
    },
    now: () => new Date(clock),
  };
}

export type World = ReturnType<typeof world>;

/** Creates a pending order through the real checkout endpoint. */
export async function createOrder(target: TestEnv | World, overrides: Record<string, unknown> = {}) {
  const w = "env" in target ? target : null;
  const env = w ? w.env : (target as TestEnv);
  const net = w ? w.net : fakeNetwork();
  const deps = w ? w.deps : makeDeps(net.fetch);
  const res = await postJson(env, deps, "/api/checkout", validCheckout(overrides));
  if (res.status !== 201) throw new Error(`checkout failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { orderId: string; orderNumber: number; orderToken: string; checkoutUrl: string };
  const sessionId = /cs_test_[A-Za-z0-9]+/.exec(body.checkoutUrl)?.[0] ?? "";
  return { ...body, sessionId, stripeCalls: net.stripeCalls };
}

/** Delivers events to the webhook endpoint, signed like Stripe signs them. */
export async function deliver(w: World, events: unknown[]) {
  const responses: Response[] = [];
  for (const event of events) responses.push(await signedWebhook(w.env, event, { now: w.now(), deps: w.deps }));
  await w.deps.flush();
  return responses;
}

/** Customer pays on Stripe's page ("authorize" by default) and Stripe sends its webhooks. */
export async function pay(w: World, sessionId: string, outcome: "authorize" | "decline" | "capture" = "authorize") {
  const events = w.stripe.completeSession(sessionId, outcome);
  w.stripe.takeEvents();
  return deliver(w, events);
}

/** An order that has reached the restaurant (payment authorised). */
export async function placedOrder(w: World, overrides: Record<string, unknown> = {}, outcome: "authorize" | "capture" = "authorize") {
  const order = await createOrder(w, overrides);
  await pay(w, order.sessionId, outcome);
  return order;
}

export function orderRow(env: TestEnv, id: string) {
  return env.DB.raw.prepare("SELECT * FROM orders WHERE id = ?").get(id) as Record<string, unknown> | undefined;
}

export function count(env: TestEnv, sql: string, ...params: (string | number)[]) {
  return Number((env.DB.raw.prepare(sql).get(...params) as { n: number }).n);
}

/** Holds the first Stripe request matching `match` until release(): a slow or hanging Stripe call. */
export function gateStripe(w: World, match: (url: string) => boolean) {
  const inner = w.deps.fetch;
  let release!: () => void;
  let reached!: () => void;
  const opened = new Promise<void>((r) => (release = r));
  const arrived = new Promise<void>((r) => (reached = r));
  let armed = true;
  w.deps.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (armed && match(url)) {
      armed = false;
      reached();
      await opened;
    }
    return inner(input, init);
  }) as typeof fetch;
  return { release, arrived };
}

export function runCron(w: World) {
  return runScheduled(w.env, w.deps).then(async (report) => {
    await w.deps.flush();
    return report;
  });
}

// ---------------------------------------------------------------------------
// Stripe webhooks
// ---------------------------------------------------------------------------

let eventSeq = 0;

export function sessionEvent(
  type: string,
  session: Record<string, unknown>,
  extra: { id?: string; livemode?: boolean } = {},
) {
  eventSeq += 1;
  return {
    id: extra.id ?? `evt_test_${eventSeq}`,
    object: "event",
    type,
    livemode: extra.livemode ?? false,
    data: { object: { object: "checkout.session", currency: "eur", livemode: extra.livemode ?? false, ...session } },
  };
}

export async function signedWebhook(
  env: Env,
  payload: unknown,
  options: { secret?: string; timestamp?: number; now?: Date; deps?: Deps } = {},
) {
  const body = JSON.stringify(payload);
  const now = options.now ?? NOW;
  const t = options.timestamp ?? Math.floor(now.getTime() / 1000);
  const sig = await hmacSha256Hex(options.secret ?? WEBHOOK_SECRET, `${t}.${body}`);
  return call(env, options.deps ?? makeDeps(fakeNetwork().fetch, now), "/api/stripe/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Stripe-Signature": `t=${t},v1=${sig}` },
    body,
  });
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

/** Opens a staff session directly in D1 (the sign-in flow itself is tested separately). */
export async function staffCookie(env: TestEnv, label = "Móvil de cocina", now: Date = NOW): Promise<string> {
  const token = newOrderToken();
  const expires = new Date(now.getTime() + 30 * 86_400_000).toISOString();
  env.DB.raw
    .prepare(
      `INSERT INTO staff_sessions (id, label, method, created_at, last_seen_at, expires_at) VALUES (?, ?, 'telegram-code', ?, ?, ?)`,
    )
    .run(await sha256Hex(token), label, now.toISOString(), now.toISOString(), expires);
  return `__Host-shp_session=${token}`;
}

export function staffCall(w: World, cookie: string, path: string, init: RequestInit = {}) {
  return call(w.env, w.deps, path, {
    ...init,
    headers: { Cookie: cookie, Origin: WORKER_ORIGIN, ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers ?? {}) },
  });
}

export async function staffAction(w: World, cookie: string, id: string, action: string, body: unknown = {}) {
  const res = await staffCall(w, cookie, `/api/admin/orders/${id}/${action}`, { method: "POST", body: JSON.stringify(body) });
  await w.deps.flush();
  return { status: res.status, body: (await res.json()) as Record<string, unknown> & { order?: Record<string, unknown> } };
}

export async function customerView(w: World, order: { orderId: string; orderToken: string }) {
  const res = await call(w.env, w.deps, `/api/orders/${order.orderId}`, { headers: { Authorization: `Bearer ${order.orderToken}` } });
  return ((await res.json()) as { order: Record<string, unknown> }).order;
}

// ---------------------------------------------------------------------------
// Cloudflare Access
// ---------------------------------------------------------------------------

export async function accessKeys(kid = "test-kid") {
  const pair = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const jwk = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid, alg: "RS256", use: "sig" };
  return { privateKey: pair.privateKey, jwk };
}

export async function signAccessJwt(
  privateKey: CryptoKey,
  claims: Record<string, unknown> = {},
  kid = "test-kid",
): Promise<string> {
  const now = Math.floor(NOW.getTime() / 1000);
  const enc = (v: unknown) => base64UrlEncode(new TextEncoder().encode(JSON.stringify(v)));
  const header = enc({ alg: "RS256", kid, typ: "JWT" });
  const payload = enc({
    aud: [ACCESS_AUD],
    iss: `https://${TEAM_DOMAIN}`,
    iat: now - 10,
    nbf: now - 10,
    exp: now + 3600,
    sub: "staff-user-id",
    email: "cocina@shanghai.example",
    ...claims,
  });
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${base64UrlEncode(new Uint8Array(sig))}`;
}

export const denyAll: RateLimiterLike = { limit: async () => ({ success: false }) };

// ---------------------------------------------------------------------------
// WhatsApp status webhooks
// ---------------------------------------------------------------------------

/** POSTs a payload to the WhatsApp webhook, signed like Meta (or with `signature` as given). */
export function whatsappWebhook(w: World, payload: unknown, signature?: string | null) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  return call(w.env, w.deps, "/api/whatsapp/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(signature === null ? {} : { "X-Hub-Signature-256": signature ?? signMeta(body, WHATSAPP_APP_SECRET) }),
    },
    body,
  });
}

/** Meta delivers the queued status updates (sent / delivered / read / failed) to the Worker. */
export async function deliverWhatsAppStatuses(w: World) {
  const responses: Response[] = [];
  for (const payload of w.whatsapp.takeStatusPayloads()) responses.push(await whatsappWebhook(w, payload));
  await w.deps.flush();
  return responses;
}
