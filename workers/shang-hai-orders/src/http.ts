import { allowedOrigins } from "./config";
import type { Env } from "./env";

export const MAX_BODY_BYTES = 16 * 1024;

const BASE_SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Cross-Origin-Resource-Policy": "same-site",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

export function securityHeaders(contentSecurityPolicy = "default-src 'none'; frame-ancestors 'none'"): Headers {
  const headers = new Headers(BASE_SECURITY_HEADERS);
  headers.set("Content-Security-Policy", contentSecurityPolicy);
  headers.set("Cache-Control", "no-store");
  return headers;
}

export function json(body: unknown, status = 200, extra?: HeadersInit): Response {
  const headers = securityHeaders();
  headers.set("Content-Type", "application/json; charset=utf-8");
  if (extra) new Headers(extra).forEach((value, key) => headers.set(key, value));
  return new Response(JSON.stringify(body), { status, headers });
}

export function errorJson(error: string, status: number, extra?: Record<string, unknown>): Response {
  return json({ error, ...extra }, status);
}

// ---------------------------------------------------------------------------
// CORS (public storefront API only; never on the webhook or the staff panel)
// ---------------------------------------------------------------------------

export function requestOrigin(request: Request): string | null {
  return request.headers.get("Origin");
}

export function isAllowedOrigin(env: Env, origin: string | null): boolean {
  return origin !== null && allowedOrigins(env).includes(origin);
}

export function withCors(response: Response, env: Env, request: Request): Response {
  const origin = requestOrigin(request);
  const headers = new Headers(response.headers);
  headers.append("Vary", "Origin");
  if (isAllowedOrigin(env, origin)) {
    headers.set("Access-Control-Allow-Origin", origin as string);
    headers.set("Access-Control-Expose-Headers", "Retry-After");
  }
  return new Response(response.body, { status: response.status, headers });
}

export function preflight(env: Env, request: Request): Response {
  const origin = requestOrigin(request);
  if (!isAllowedOrigin(env, origin)) {
    const headers = securityHeaders();
    headers.set("Vary", "Origin");
    return new Response(null, { status: 403, headers });
  }
  const headers = securityHeaders();
  headers.set("Access-Control-Allow-Origin", origin as string);
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Max-Age", "600");
  headers.set("Vary", "Origin");
  return new Response(null, { status: 204, headers });
}

// ---------------------------------------------------------------------------
// Bodies
// ---------------------------------------------------------------------------

/** Reads the body as text, refusing anything over `maxBytes` without buffering it all. */
export async function readBodyLimited(
  request: Request,
  maxBytes = MAX_BODY_BYTES,
): Promise<{ ok: true; text: string } | { ok: false }> {
  const declared = Number(request.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false };
  if (!request.body) return { ok: true, text: "" };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return { ok: false };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(bytes) };
}

export function isJsonRequest(request: Request): boolean {
  const type = request.headers.get("Content-Type") ?? "";
  return /^application\/json(\s*;|$)/i.test(type);
}

export function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "unknown";
}
