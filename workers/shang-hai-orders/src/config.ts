import type { Env } from "./env";

export type PaymentsMode = "stripe-test" | "stripe-live" | "disabled";

export type PaymentsConfig =
  | { mode: "stripe-test" | "stripe-live"; secretKey: string; webhookSecret: string }
  | {
      mode: "disabled";
      reason:
        | "missing-secret-key"
        | "missing-webhook-secret"
        | "live-key-in-test-mode"
        | "live-payments-not-approved"
        | "unrecognised-key";
    };

/** Stripe API version pinned for every request (docs.stripe.com/api/versioning, 2026-10-29). */
export const STRIPE_API_VERSION = "2026-09-30.endive";

/**
 * Decides whether this deployment may take payments, and in which mode.
 *
 * - No secret key or no webhook secret -> disabled (we never take a payment we cannot
 *   confirm through a verified webhook).
 * - STRIPE_TEST_MODE defaults to "true" and then only test keys (sk_test_/rk_test_) work.
 * - Live keys need STRIPE_TEST_MODE="false" AND PAYMENTS_LIVE_ENABLED="true", which is the
 *   owner's explicit approval. Neither value is set anywhere in this repository.
 */
export function resolvePayments(env: Env): PaymentsConfig {
  const secretKey = env.STRIPE_SECRET_KEY?.trim() ?? "";
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
  if (!secretKey) return { mode: "disabled", reason: "missing-secret-key" };
  if (!webhookSecret) return { mode: "disabled", reason: "missing-webhook-secret" };

  const testMode = (env.STRIPE_TEST_MODE ?? "true").trim().toLowerCase() !== "false";
  const isTestKey = /^(sk|rk)_test_/.test(secretKey);
  const isLiveKey = /^(sk|rk)_live_/.test(secretKey);

  if (testMode) {
    if (isTestKey) return { mode: "stripe-test", secretKey, webhookSecret };
    return { mode: "disabled", reason: isLiveKey ? "live-key-in-test-mode" : "unrecognised-key" };
  }
  if (isLiveKey && env.PAYMENTS_LIVE_ENABLED?.trim() === "true") {
    return { mode: "stripe-live", secretKey, webhookSecret };
  }
  return { mode: "disabled", reason: isLiveKey ? "live-payments-not-approved" : "unrecognised-key" };
}

export function allowedOrigins(env: Env): string[] {
  return (env.CORS_ALLOWED_ORIGIN ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

const DEFAULT_SUCCESS_URL =
  "https://wh14-ua.github.io/mangocat-test/showcase/shang-hai/{storefront}/pedido/estado/?pedido={orderId}&t={token}&lang={lang}";
const DEFAULT_CANCEL_URL =
  "https://wh14-ua.github.io/mangocat-test/showcase/shang-hai/{storefront}/pedido/?cancelado=1&pedido={orderId}&lang={lang}";

/**
 * Fills {storefront}, {orderId}, {token} and {lang} in the configured return URL templates.
 * Templates written before the language existed get `lang=` appended, so the customer
 * comes back from Stripe in the language they paid in. Stripe's own {CHECKOUT_SESSION_ID}
 * placeholder is left untouched for Stripe to fill. Only https URLs (or http://localhost
 * for development) are accepted.
 */
export function buildReturnUrls(
  env: Env,
  values: { storefront: string; orderId: string; token: string; locale?: "es" | "en" },
): { successUrl: string; cancelUrl: string } | null {
  const lang = values.locale ?? "es";
  const fill = (template: string) => {
    const filled = template
      .replaceAll("{storefront}", encodeURIComponent(values.storefront))
      .replaceAll("{orderId}", encodeURIComponent(values.orderId))
      .replaceAll("{token}", encodeURIComponent(values.token))
      .replaceAll("{lang}", lang);
    if (template.includes("{lang}")) return filled;
    return `${filled}${filled.includes("?") ? "&" : "?"}lang=${lang}`;
  };
  const successUrl = fill(env.STRIPE_SUCCESS_URL?.trim() || DEFAULT_SUCCESS_URL);
  const cancelUrl = fill(env.STRIPE_CANCEL_URL?.trim() || DEFAULT_CANCEL_URL);
  return isSafeReturnUrl(successUrl) && isSafeReturnUrl(cancelUrl) ? { successUrl, cancelUrl } : null;
}

function isSafeReturnUrl(value: string): boolean {
  try {
    const url = new URL(value.replace("{CHECKOUT_SESSION_ID}", "cs_placeholder"));
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

export function accessConfig(env: Env): { teamDomain: string; aud: string } | null {
  const raw = env.ACCESS_TEAM_DOMAIN?.trim() ?? "";
  const aud = env.ACCESS_AUD?.trim() ?? "";
  if (!raw || !aud) return null;
  const teamDomain = raw.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return { teamDomain, aud };
}

// ---------------------------------------------------------------------------
// Acceptance flow, notifications and deployment shape
// ---------------------------------------------------------------------------

export type WorkerRole = "all" | "api" | "panel";

/**
 * One codebase, two possible deployments: everything on one Worker ("all"), or the
 * public API + webhook + cron on one Worker ("api") and the staff panel on another
 * ("panel") whose whole hostname sits behind Cloudflare Access. Both share the D1 database.
 */
export function workerRole(env: Env): WorkerRole {
  const role = (env.WORKER_ROLE ?? "all").trim().toLowerCase();
  return role === "api" || role === "panel" ? role : "all";
}

export function isTestMode(env: Env): boolean {
  return (env.STRIPE_TEST_MODE ?? "true").trim().toLowerCase() !== "false";
}

export function isLocalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

/** A localhost override, honoured only in test mode (the local mock stack). */
function localOverride(env: Env, value: string | undefined): string | null {
  const v = value?.trim().replace(/\/+$/, "");
  return v && isTestMode(env) && isLocalUrl(v) ? v : null;
}

export function stripeApiBase(env: Env): string {
  return localOverride(env, env.STRIPE_API_BASE) ?? "https://api.stripe.com/v1";
}

export function telegramApiBase(env: Env): string {
  return localOverride(env, env.TELEGRAM_API_BASE) ?? "https://api.telegram.org";
}

export function accessCertsUrl(env: Env, teamDomain: string): string {
  return localOverride(env, env.ACCESS_CERTS_URL) ?? `https://${teamDomain}/cdn-cgi/access/certs`;
}

/** Only genuine Stripe-hosted Checkout pages (or the local mock's, in test mode). */
export function isAllowedCheckoutUrl(env: Env, url: string): boolean {
  if (url.startsWith("https://checkout.stripe.com/")) return true;
  const local = localOverride(env, env.STRIPE_API_BASE);
  return local !== null && url.startsWith(new URL(local).origin + "/");
}

export type CaptureMode = "manual" | "per-method";

export function captureMode(env: Env): CaptureMode {
  return (env.STRIPE_CAPTURE_MODE ?? "").trim().toLowerCase() === "per-method" ? "per-method" : "manual";
}

export const PREP_MINUTES_MIN = 5;
export const PREP_MINUTES_MAX = 180;
const DEFAULT_PREP_OPTIONS = [15, 20, 30, 45];

/** The quick choices offered to staff; any whole number within 5–180 is also accepted. */
export function prepTimeOptions(env: Env): number[] {
  const parsed = (env.PREP_TIME_OPTIONS ?? "")
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isInteger(n) && n >= PREP_MINUTES_MIN && n <= PREP_MINUTES_MAX);
  const unique = [...new Set(parsed)].sort((a, b) => a - b).slice(0, 8);
  return unique.length ? unique : DEFAULT_PREP_OPTIONS;
}

function minutesVar(value: string | undefined, fallback: number, max: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const n = Number(value.trim());
  return Number.isInteger(n) && n >= 0 && n <= max ? n : fallback;
}

/** Reminder alert when an order waits this long for a decision (0 disables it). */
export function reminderMinutes(env: Env): number {
  return minutesVar(env.ACCEPTANCE_REMINDER_MINUTES, 4, 120);
}

/**
 * Without a decision for this long, the order is declined automatically and the hold on
 * the customer's card released, so nobody waits days for an answer (0 disables it).
 */
export function acceptanceTimeoutMinutes(env: Env): number {
  return minutesVar(env.ACCEPTANCE_TIMEOUT_MINUTES, 30, 24 * 60);
}

export type TelegramConfig = { token: string; chatIds: string[] };

/** Telegram alerts need a bot token (secret) and at least one authorised chat id. */
export function telegramConfig(env: Env): TelegramConfig | null {
  const token = env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  const chatIds = (env.TELEGRAM_CHAT_IDS ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter((c) => /^-?\d{1,20}$/.test(c));
  if (!/^\d{5,16}:[A-Za-z0-9_-]{20,}$/.test(token) || chatIds.length === 0) return null;
  return { token, chatIds: [...new Set(chatIds)] };
}

/** The staff panel's public URL (https, or localhost for the mock stack). */
export function panelUrl(env: Env): string | null {
  const raw = env.PANEL_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol === "https:" || isLocalUrl(raw)) return url.href.replace(/#.*$/, "");
  } catch {
    /* invalid */
  }
  return null;
}
