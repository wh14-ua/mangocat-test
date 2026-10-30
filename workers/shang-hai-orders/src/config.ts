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
  "https://wh14-ua.github.io/mangocat-test/showcase/shang-hai/{storefront}/pedido/estado/?pedido={orderId}&t={token}";
const DEFAULT_CANCEL_URL =
  "https://wh14-ua.github.io/mangocat-test/showcase/shang-hai/{storefront}/pedido/?cancelado=1&pedido={orderId}";

/**
 * Fills {storefront}, {orderId} and {token} in the configured return URL templates.
 * Stripe's own {CHECKOUT_SESSION_ID} placeholder is left untouched for Stripe to fill.
 * Only https URLs (or http://localhost for development) are accepted.
 */
export function buildReturnUrls(
  env: Env,
  values: { storefront: string; orderId: string; token: string },
): { successUrl: string; cancelUrl: string } | null {
  const fill = (template: string) =>
    template
      .replaceAll("{storefront}", encodeURIComponent(values.storefront))
      .replaceAll("{orderId}", encodeURIComponent(values.orderId))
      .replaceAll("{token}", encodeURIComponent(values.token));
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
