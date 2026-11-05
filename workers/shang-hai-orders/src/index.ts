/**
 * Shang Hai order Worker — the single order backend shared by the three storefronts.
 *
 * Public (storefronts, CORS allowlist):
 *   GET  /api/health                     liveness + payments mode
 *   GET  /api/config                     { paymentsMode }
 *   POST /api/checkout                   validate, price (server-side), store, create Stripe session
 *   GET  /api/orders/:id                 order status for the customer (Bearer order token)
 * Stripe:
 *   POST /api/stripe/webhook             verified Stripe events -> order/payment state
 * Staff panel (mobile PWA):
 *   GET  /admin, /admin/*                panel shell and assets (no data inside)
 *   POST /api/admin/auth/code|verify     Telegram one-time code sign-in
 *   GET  /api/admin/session|board        who am I / live board
 *   GET  /api/admin/orders/:id           detail with history and alert log
 *   POST /api/admin/orders/:id/(accept|reject|ready|complete|retry)
 *   POST /api/admin/auth/logout
 * Cron (every minute): stale locks, timeouts, reminders, missed webhooks, alert retries.
 */
import { panelAsset, panelHtml } from "../panel/server";
import { handleBoard, handleOrderDetail, handleSession, handleStaffAction, parseAction } from "./admin";
import { handleCheckout } from "./checkout";
import { workerRole } from "./config";
import { base64UrlEncode, randomBytes } from "./crypto";
import { runScheduled } from "./cron";
import { defaultDeps, type Deps, type Env } from "./env";
import { errorJson, json, preflight, securityHeaders, withCors } from "./http";
import { log } from "./log";
import { handleOrderLookup } from "./orders";
import { authorizeStaff, handleLoginCode, handleLoginVerify, handleLogout } from "./staff-auth";
import { handleStripeWebhook, paymentsModeFor } from "./webhook";

const PUBLIC_API = /^\/api\/(health|config|checkout|orders\/[^/]+)$/;

/** Malformed %-escapes in an id are simply "not found", never a server error. */
function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return "";
  }
}

function panelPage(): Response {
  const nonce = base64UrlEncode(randomBytes(16));
  const headers = securityHeaders(
    [
      "default-src 'none'",
      `script-src 'nonce-${nonce}'`,
      `style-src 'nonce-${nonce}'`,
      "connect-src 'self'",
      "img-src 'self' data:",
      "manifest-src 'self'",
      "worker-src 'self'",
      "media-src 'self' data:",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join("; "),
  );
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("X-Robots-Tag", "noindex, nofollow");
  return new Response(panelHtml(nonce), { status: 200, headers });
}

function panelStatic(path: string): Response | null {
  const asset = panelAsset(path);
  if (!asset) return null;
  const headers = securityHeaders();
  headers.set("Content-Type", asset.contentType);
  headers.set("Cache-Control", asset.cacheControl);
  if (path.endsWith("/sw.js")) headers.set("Service-Worker-Allowed", "/admin/");
  // Copy binary assets into a plain ArrayBuffer-backed view (valid BodyInit everywhere).
  const body = typeof asset.body === "string" ? asset.body : new Uint8Array(asset.body);
  return new Response(body, { status: 200, headers });
}

export async function handleRequest(request: Request, env: Env, deps: Deps): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method.toUpperCase();
  const role = workerRole(env);
  const servesApi = role !== "panel";
  const servesPanel = role !== "api";

  try {
    // Public storefront API (CORS-enabled for the configured origins only)
    if (servesApi && PUBLIC_API.test(path)) {
      if (method === "OPTIONS") return preflight(env, request);
      const response = await routePublic(request, env, deps, path, method);
      return withCors(response, env, request);
    }

    if (servesApi && path === "/api/stripe/webhook") {
      if (method !== "POST") return errorJson("method-not-allowed", 405);
      return await handleStripeWebhook(request, env, deps);
    }

    if (servesPanel && (path === "/admin" || path.startsWith("/admin/"))) {
      if (method !== "GET") return errorJson("method-not-allowed", 405);
      if (path === "/admin") return panelPage();
      return panelStatic(url.pathname) ?? errorJson("not-found", 404);
    }

    if (servesPanel && path.startsWith("/api/admin")) return await routeStaff(request, env, deps, path, method);

    if (path === "/") {
      const headers = securityHeaders();
      headers.set("Content-Type", "text/plain; charset=utf-8");
      return new Response("Shang Hai orders API", { status: 200, headers });
    }
    return errorJson("not-found", 404);
  } catch (error) {
    log("request.error", { path, message: error instanceof Error ? error.message : "unknown" });
    const response = errorJson("server", 500);
    return PUBLIC_API.test(path) ? withCors(response, env, request) : response;
  }
}

async function routePublic(request: Request, env: Env, deps: Deps, path: string, method: string) {
  if (path === "/api/health" && method === "GET") {
    return json({ ok: true, paymentsMode: paymentsModeFor(env) });
  }
  if (path === "/api/config" && method === "GET") {
    return json({ paymentsMode: paymentsModeFor(env) });
  }
  if (path === "/api/checkout") {
    return method === "POST" ? handleCheckout(request, env, deps) : errorJson("method-not-allowed", 405);
  }
  const order = /^\/api\/orders\/([^/]+)$/.exec(path);
  if (order && method === "GET") return handleOrderLookup(request, env, safeDecode(order[1]));
  return errorJson("method-not-allowed", 405);
}

async function routeStaff(request: Request, env: Env, deps: Deps, path: string, method: string): Promise<Response> {
  // Sign-in endpoints are reachable without a session (they are how one gets a session).
  if (path === "/api/admin/auth/code" && method === "POST") return handleLoginCode(request, env, deps);
  if (path === "/api/admin/auth/verify" && method === "POST") return handleLoginVerify(request, env, deps, env.LOGIN_LIMITER);

  const auth = await authorizeStaff(request, env, deps);
  if (!auth.ok) return auth.response;
  const identity = auth.identity;

  if (path === "/api/admin/session" && method === "GET") return handleSession(env, identity);
  if (path === "/api/admin/auth/logout" && method === "POST") return handleLogout(request, env, deps, identity);
  if (path === "/api/admin/board" && method === "GET") return handleBoard(env, deps);
  const detail = /^\/api\/admin\/orders\/([^/]+)$/.exec(path);
  if (detail && method === "GET") return handleOrderDetail(env, deps, safeDecode(detail[1]));
  const action = /^\/api\/admin\/orders\/([^/]+)\/([a-z]+)$/.exec(path);
  if (action && method === "POST") {
    const name = parseAction(action[2]);
    if (name) return handleStaffAction(request, env, deps, safeDecode(action[1]), name, identity);
  }
  return errorJson("not-found", 404);
}

const worker = {
  fetch(request: Request, env: Env, ctx: { waitUntil(promise: Promise<unknown>): void }): Promise<Response> {
    return handleRequest(request, env, defaultDeps(ctx));
  },
  async scheduled(_controller: unknown, env: Env, ctx: { waitUntil(promise: Promise<unknown>): void }): Promise<void> {
    if (workerRole(env) === "panel") return;
    const deps = defaultDeps(ctx);
    const report = await runScheduled(env, deps);
    log("cron.done", report);
  },
};

export default worker;
