import { cleanText } from "../../../src/lib/commerce/validation";
import { verifyAccessJwt } from "./access";
import { accessCertsUrl, accessConfig, codeChannels, telegramApiBase, telegramConfig, whatsappConfig } from "./config";
import { hmacSha256Hex, newOrderToken, randomBytes, sha256Hex, timingSafeEqual } from "./crypto";
import type { Deps, Env, RateLimiterLike } from "./env";
import { clientIp, errorJson, isJsonRequest, json, readBodyLimited } from "./http";
import { log } from "./log";
import { allow } from "./rate-limit";
import { sendTelegramMessage } from "./telegram";
import { loginCodeMessage, sendWhatsAppTemplate } from "./whatsapp";
import { recordWhatsAppSend, takeWhatsAppTurn } from "./notifications";

/**
 * Who may use the staff panel. Two server-verified ways in, no passwords anywhere:
 *
 * 1. Cloudflare Access (optional): a valid Access JWT (RS256, aud, iss, exp) in the
 *    Cf-Access-Jwt-Assertion header or the CF_Authorization cookie.
 * 2. One-time code (recommended for phones): the panel asks for a code, and a 6-digit code is
 *    sent ONLY to the authorised recipients — by WhatsApp (an approved AUTHENTICATION template
 *    to WHATSAPP_RECIPIENTS) and/or Telegram (TELEGRAM_CHAT_IDS). Entering it opens a 30-day
 *    session in an HttpOnly, Secure, SameSite=Strict cookie. Works inside an installed
 *    home-screen app on iOS, whose cookies are separate from Safari's.
 *
 * Codes: 10 minutes, single use, 5 wrong tries max, at most one request every 30 s and
 * 8 per hour. Only hashes of codes and session tokens are stored. Without Access and
 * without a code channel the panel is closed (503), never open.
 */

export type StaffIdentity = { method: "access" | "code"; label: string; sessionId?: string };

export type StaffAuth = { ok: true; identity: StaffIdentity } | { ok: false; response: Response };

export const SESSION_COOKIE = "__Host-shp_session";
const SESSION_DAYS = 30;
const CODE_TTL_MS = 10 * 60_000;
const CODE_MAX_ATTEMPTS = 5;
const CODE_MIN_INTERVAL_MS = 30_000;
/** How long a sign-in code waits for its WhatsApp turn (one pair-rate interval and a margin). */
const CODE_TURN_WAIT_MS = 7_000;
const CODES_PER_HOUR = 8;
const LAST_SEEN_REFRESH_MS = 10 * 60_000;

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=") || null;
  }
  return null;
}

export function loginMethods(env: Env): ("access" | "whatsapp" | "telegram")[] {
  return [...(accessConfig(env) ? (["access"] as const) : []), ...codeChannels(env)];
}

type SessionRow = { id: string; label: string; expires_at: string; revoked_at: string | null; last_seen_at: string };

async function sessionIdentity(env: Env, deps: Deps, token: string): Promise<StaffIdentity | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const id = await sha256Hex(token);
  const row = await env.DB.prepare(`SELECT id, label, expires_at, revoked_at, last_seen_at FROM staff_sessions WHERE id = ?`)
    .bind(id)
    .first<SessionRow>();
  const now = deps.now();
  if (!row || row.revoked_at || Date.parse(row.expires_at) <= now.getTime()) return null;
  if (now.getTime() - Date.parse(row.last_seen_at) > LAST_SEEN_REFRESH_MS) {
    // Sliding expiry: a phone used every day stays signed in.
    const expires = new Date(now.getTime() + SESSION_DAYS * 86_400_000).toISOString();
    await env.DB.prepare(`UPDATE staff_sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?`)
      .bind(now.toISOString(), expires, id)
      .run();
  }
  return { method: "code", label: row.label, sessionId: id };
}

export async function authorizeStaff(request: Request, env: Env, deps: Deps): Promise<StaffAuth> {
  const methods = loginMethods(env);
  if (methods.length === 0) return { ok: false, response: errorJson("admin-not-configured", 503) };

  const access = accessConfig(env);
  const jwt = request.headers.get("Cf-Access-Jwt-Assertion") ?? readCookie(request, "CF_Authorization");
  if (access && jwt) {
    const check = await verifyAccessJwt(jwt, { ...access, certsUrl: accessCertsUrl(env, access.teamDomain) }, deps);
    if (check.ok) return { ok: true, identity: { method: "access", label: check.identity.email ?? check.identity.subject } };
    log("admin.denied", { reason: check.reason });
  }
  if (codeChannels(env).length) {
    const token = readCookie(request, SESSION_COOKIE);
    const identity = token ? await sessionIdentity(env, deps, token) : null;
    if (identity) return { ok: true, identity };
  }
  return { ok: false, response: json({ error: "unauthorized", login: methods }, 401) };
}

/**
 * Mutations must come from the panel itself: same origin, JSON body (CSRF). Browsers always
 * send Origin on POST, so a request without one is not the panel and is refused too.
 */
export function sameOriginJson(request: Request): Response | null {
  const origin = request.headers.get("Origin");
  if (origin !== new URL(request.url).origin) return errorJson("forbidden-origin", 403);
  if (!isJsonRequest(request)) return errorJson("unsupported-media-type", 415);
  return null;
}

function sixDigits(): string {
  // Rejection sampling keeps every code equally likely.
  for (;;) {
    const [a, b, c] = randomBytes(3);
    const n = (a << 16) | (b << 8) | c;
    if (n < 16_000_000) return String(n % 1_000_000).padStart(6, "0");
  }
}

/**
 * Codes are stored as HMAC(secret, code). The secret is STAFF_CODE_SECRET when set, else a
 * configured channel's credential — never empty (no code channel = no codes at all).
 */
async function codeHash(env: Env, code: string): Promise<string> {
  const secret = env.STAFF_CODE_SECRET?.trim() || whatsappConfig(env)?.token || telegramConfig(env)?.token || "";
  if (!secret) throw new Error("no secret for staff codes");
  return hmacSha256Hex(secret, `staff-login:${code}`);
}

const RATE_LIMITED = () =>
  json({ error: "rate-limited", message: "Ya se ha enviado un código hace muy poco. Revisa WhatsApp o espera un momento." }, 429, {
    "Retry-After": "30",
  });

/** POST /api/admin/auth/code — sends a sign-in code to the authorised WhatsApp numbers / Telegram chats. */
export async function handleLoginCode(request: Request, env: Env, deps: Deps, limiter?: RateLimiterLike): Promise<Response> {
  const bad = sameOriginJson(request);
  if (bad) return bad;
  const whatsapp = whatsappConfig(env);
  const telegram = telegramConfig(env);
  if (!whatsapp && !telegram) return errorJson("login-unavailable", 503);
  if (!(await allow(limiter, `login-code:${clientIp(request)}`))) return RATE_LIMITED();
  const now = deps.now();
  const code = sixDigits();
  const created = now.toISOString();
  const expires = new Date(now.getTime() + CODE_TTL_MS).toISOString();
  // One statement decides and inserts (no check-then-act race: concurrent requests cannot all
  // pass the "one code every 30 s / N per hour" rule); only then is the previous code retired.
  const [inserted] = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO staff_login_codes (code_hash, created_at, expires_at)
       SELECT ?, ?, ?
        WHERE (SELECT COUNT(*) FROM staff_login_codes WHERE created_at >= ?) < ?
          AND NOT EXISTS (SELECT 1 FROM staff_login_codes WHERE created_at > ?)`,
    ).bind(
      await codeHash(env, code),
      created,
      expires,
      new Date(now.getTime() - 3_600_000).toISOString(),
      CODES_PER_HOUR,
      new Date(now.getTime() - CODE_MIN_INTERVAL_MS).toISOString(),
    ),
    // A new code replaces any previous one.
    env.DB.prepare(`UPDATE staff_login_codes SET used_at = ? WHERE used_at IS NULL AND id <> last_insert_rowid() AND changes() > 0`).bind(created),
  ]);
  if (!inserted.meta.changes) return RATE_LIMITED();
  const channels: string[] = [];
  let sent = 0;
  // WhatsApp: the approved authentication template (fixed Meta text + copy-code button).
  for (const number of whatsapp?.recipients ?? []) {
    // Its turn first (pair rate limit: an alert may have just gone to this number). Someone is
    // waiting for the code, so after a few seconds it goes anyway; alerts then wait for it.
    const turn = await takeWhatsAppTurn(env, deps, number, deps.now().getTime() + CODE_TURN_WAIT_MS);
    if (!turn.ours) await recordWhatsAppSend(env, number, deps.now().toISOString());
    const res = await sendWhatsAppTemplate(deps.fetch, whatsapp!, number, loginCodeMessage(code));
    await recordWhatsAppSend(env, number, deps.now().toISOString());
    if (res.ok) {
      sent += 1;
      if (!channels.includes("whatsapp")) channels.push("whatsapp");
    } else {
      log("admin.login-code-failed", { channel: "whatsapp", failure: res.kind, error: res.error });
    }
  }
  for (const chatId of telegram?.chatIds ?? []) {
    const res = await sendTelegramMessage(deps.fetch, {
      apiBase: telegramApiBase(env),
      token: telegram!.token,
      chatId,
      html: `🔐 Código para entrar en <b>SHANG HAI — PEDIDOS</b>: <b>${code}</b>\nCaduca en 10 minutos. No lo compartas con nadie: el restaurante nunca te lo pedirá.`,
    });
    if (res.ok) {
      sent += 1;
      if (!channels.includes("telegram")) channels.push("telegram");
    }
  }
  log("admin.login-code", { sent, channels: channels.join(",") });
  if (!sent) return json({ error: "delivery-failed", message: "No se ha podido enviar el código." }, 502);
  return json({ sent, channels, expiresInSeconds: CODE_TTL_MS / 1000 }, 202);
}

/** POST /api/admin/auth/verify — exchanges a valid code for a session cookie. */
export async function handleLoginVerify(request: Request, env: Env, deps: Deps, limiter?: RateLimiterLike): Promise<Response> {
  const bad = sameOriginJson(request);
  if (bad) return bad;
  if (!codeChannels(env).length) return errorJson("login-unavailable", 503);
  if (!(await allow(limiter, `login:${clientIp(request)}`))) {
    return json({ error: "rate-limited", message: "Demasiados intentos. Espera un minuto." }, 429, { "Retry-After": "60" });
  }
  const body = await readBodyLimited(request, 1024);
  if (!body.ok) return errorJson("payload-too-large", 413);
  let payload: { code?: unknown; label?: unknown };
  try {
    payload = JSON.parse(body.text) as typeof payload;
  } catch {
    return errorJson("invalid", 400);
  }
  const code = typeof payload.code === "string" ? payload.code.replace(/\s+/g, "") : "";
  if (!/^\d{6}$/.test(code)) return json({ error: "invalid-code", message: "El código tiene 6 cifras." }, 400);

  const now = deps.now();
  const nowIso = now.toISOString();
  const active = await env.DB.prepare(
    `SELECT id, code_hash, attempts FROM staff_login_codes
      WHERE used_at IS NULL AND expires_at > ? AND attempts < ? ORDER BY id DESC LIMIT 1`,
  )
    .bind(nowIso, CODE_MAX_ATTEMPTS)
    .first<{ id: number; code_hash: string; attempts: number }>();
  if (!active) return json({ error: "invalid-code", message: "El código no es válido o ha caducado. Pide uno nuevo." }, 401);

  // Every guess spends one attempt atomically BEFORE it is compared, so concurrent guesses
  // cannot exceed the limit (each must win this conditional update).
  const charged = await env.DB.prepare(`UPDATE staff_login_codes SET attempts = attempts + 1 WHERE id = ? AND attempts < ?`)
    .bind(active.id, CODE_MAX_ATTEMPTS)
    .run();
  if (!charged.meta.changes) return json({ error: "invalid-code", message: "Demasiados intentos con este código. Pide uno nuevo." }, 401);
  const matches = timingSafeEqual(await codeHash(env, code), active.code_hash);
  if (!matches) return json({ error: "invalid-code", message: "Código incorrecto." }, 401);
  // Single use: only the request that flips used_at wins.
  const used = await env.DB.prepare(`UPDATE staff_login_codes SET used_at = ? WHERE id = ? AND used_at IS NULL`)
    .bind(nowIso, active.id)
    .run();
  if (!used.meta.changes) return json({ error: "invalid-code", message: "El código ya se ha usado. Pide uno nuevo." }, 401);

  const token = newOrderToken();
  const label = cleanText(payload.label, 40) || "Móvil del restaurante";
  const expires = new Date(now.getTime() + SESSION_DAYS * 86_400_000).toISOString();
  await env.DB.prepare(
    `INSERT INTO staff_sessions (id, label, method, created_at, last_seen_at, expires_at) VALUES (?, ?, 'code', ?, ?, ?)`,
  )
    .bind(await sha256Hex(token), label, nowIso, nowIso, expires)
    .run();
  log("admin.login", { method: "code" });
  return json({ ok: true, label }, 200, {
    "Set-Cookie": `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS * 86_400}`,
  });
}

/** POST /api/admin/auth/logout — closes this device's session (or every session). */
export async function handleLogout(request: Request, env: Env, deps: Deps, identity: StaffIdentity): Promise<Response> {
  const bad = sameOriginJson(request);
  if (bad) return bad;
  const body = await readBodyLimited(request, 256);
  const everywhere = body.ok && /"everywhere"\s*:\s*true/.test(body.text);
  const now = deps.now().toISOString();
  if (everywhere) {
    await env.DB.prepare(`UPDATE staff_sessions SET revoked_at = ? WHERE revoked_at IS NULL`).bind(now).run();
  } else if (identity.sessionId) {
    await env.DB.prepare(`UPDATE staff_sessions SET revoked_at = ? WHERE id = ?`).bind(now, identity.sessionId).run();
  }
  return json({ ok: true, everywhere }, 200, {
    "Set-Cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  });
}

export { newOrderToken as newSessionToken };
