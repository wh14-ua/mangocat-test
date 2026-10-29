/**
 * Shang Hai order Worker — the single order backend shared by the three storefronts.
 *
 *   GET  /api/health                  liveness + payments mode
 *   GET  /api/config                  { paymentsMode }
 *   POST /api/checkout                validate, price (server-side), store, create Stripe session
 *   GET  /api/orders/:id              order status for the customer (Bearer order token)
 *   POST /api/stripe/webhook          verified Stripe events -> payment status
 *   GET  /admin                       staff panel (Cloudflare Access)
 *   GET  /api/admin/orders            staff: list
 *   GET  /api/admin/orders/:id        staff: detail
 *   POST /api/admin/orders/:id/status staff: preparing / ready / completed / cancelled
 */
import { adminPage } from "./admin-page";
import { authorizeStaff, handleAdminDetail, handleAdminList, handleAdminStatus } from "./admin";
import { handleCheckout } from "./checkout";
import { defaultDeps, type Deps, type Env } from "./env";
import { errorJson, json, preflight, securityHeaders, withCors } from "./http";
import { log } from "./log";
import { handleOrderLookup } from "./orders";
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

export async function handleRequest(request: Request, env: Env, deps: Deps): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method.toUpperCase();

  try {
    // Public storefront API (CORS-enabled for the configured origins only)
    if (PUBLIC_API.test(path)) {
      if (method === "OPTIONS") return preflight(env, request);
      const response = await routePublic(request, env, deps, path, method);
      return withCors(response, env, request);
    }

    if (path === "/api/stripe/webhook") {
      if (method !== "POST") return errorJson("method-not-allowed", 405);
      return await handleStripeWebhook(request, env, deps);
    }

    if (path === "/admin" || path.startsWith("/api/admin")) {
      const auth = await authorizeStaff(request, env, deps);
      if (!auth.ok) return auth.response;
      if (path === "/admin" && method === "GET") return adminPage();
      if (path === "/api/admin/orders" && method === "GET") return await handleAdminList(request, env);
      const detail = /^\/api\/admin\/orders\/([^/]+)$/.exec(path);
      if (detail && method === "GET") return await handleAdminDetail(env, safeDecode(detail[1]));
      const status = /^\/api\/admin\/orders\/([^/]+)\/status$/.exec(path);
      if (status && method === "POST") {
        return await handleAdminStatus(request, env, deps, safeDecode(status[1]), auth.identity);
      }
      return errorJson("not-found", 404);
    }

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

const worker = {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env, defaultDeps());
  },
};

export default worker;
