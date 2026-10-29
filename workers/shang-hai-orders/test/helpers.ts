import { handleRequest } from "../src/index";
import { base64UrlEncode, hmacSha256Hex } from "../src/crypto";
import type { Deps, Env, RateLimiterLike } from "../src/env";
import { createTestD1 } from "./d1-sqlite";

export const TEST_SECRET_KEY = "sk_test_51FakeKeyForUnitTestsOnly";
export const WEBHOOK_SECRET = "whsec_unit_test_secret";
export const STOREFRONT_ORIGIN = "https://wh14-ua.github.io";
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
    ...overrides,
  } as TestEnv;
}

export type StripeCall = { url: string; headers: Headers; form: URLSearchParams };

/** Session ids are unique across the whole run, like real Stripe ids. */
let sessionSeq = 0;

/** Fake network: a scripted Stripe API plus an optional Cloudflare Access JWKS endpoint. */
export function fakeNetwork(options: { stripe?: "ok" | "error" | "bad-url"; jwks?: JsonWebKey[] } = {}) {
  const stripeCalls: StripeCall[] = [];
  let jwksRequests = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("https://api.stripe.com/")) {
      stripeCalls.push({ url, headers: new Headers(init?.headers), form: new URLSearchParams(String(init?.body ?? "")) });
      if (options.stripe === "error") {
        return new Response(JSON.stringify({ error: { message: "Stripe is down" } }), { status: 500 });
      }
      sessionSeq += 1;
      const id = `cs_test_fake${sessionSeq}`;
      const hosted = options.stripe === "bad-url" ? "https://evil.example/pay" : `https://checkout.stripe.com/c/pay/${id}`;
      return Response.json({ id, url: hosted, object: "checkout.session" });
    }
    if (url === `https://${TEAM_DOMAIN}/cdn-cgi/access/certs`) {
      jwksRequests += 1;
      return Response.json({ keys: options.jwks ?? [] });
    }
    throw new Error(`Unexpected outbound request to ${url}`);
  };
  return { fetch: fetchImpl, stripeCalls, jwksRequests: () => jwksRequests };
}

export function makeDeps(fetchImpl: typeof fetch, now: Date = NOW): Deps {
  return { fetch: fetchImpl, now: () => now, jwksCache: new Map() };
}

export function call(env: Env, deps: Deps, path: string, init: RequestInit = {}): Promise<Response> {
  return handleRequest(new Request(`https://orders.example.workers.dev${path}`, init), env, deps);
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

export function postJson(env: Env, deps: Deps, path: string, body: unknown, headers: Record<string, string> = {}) {
  return call(env, deps, path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: STOREFRONT_ORIGIN, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** Creates a pending order through the real checkout endpoint. */
export async function createOrder(env: TestEnv, overrides: Record<string, unknown> = {}) {
  const net = fakeNetwork();
  const res = await postJson(env, makeDeps(net.fetch), "/api/checkout", validCheckout(overrides));
  if (res.status !== 201) throw new Error(`checkout failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { orderId: string; orderToken: string; checkoutUrl: string };
  const sessionId = /cs_test_[A-Za-z0-9]+/.exec(body.checkoutUrl)?.[0] ?? "";
  return { ...body, sessionId, stripeCalls: net.stripeCalls };
}

export function orderRow(env: TestEnv, id: string) {
  return env.DB.raw.prepare("SELECT * FROM orders WHERE id = ?").get(id) as Record<string, unknown> | undefined;
}

export function count(env: TestEnv, sql: string, ...params: (string | number)[]) {
  return Number((env.DB.raw.prepare(sql).get(...params) as { n: number }).n);
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
  options: { secret?: string; timestamp?: number; now?: Date } = {},
) {
  const body = JSON.stringify(payload);
  const now = options.now ?? NOW;
  const t = options.timestamp ?? Math.floor(now.getTime() / 1000);
  const sig = await hmacSha256Hex(options.secret ?? WEBHOOK_SECRET, `${t}.${body}`);
  return call(env, makeDeps(fakeNetwork().fetch, now), "/api/stripe/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Stripe-Signature": `t=${t},v1=${sig}` },
    body,
  });
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
