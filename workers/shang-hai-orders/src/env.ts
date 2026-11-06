/**
 * Worker environment and runtime dependencies.
 *
 * Bindings are typed structurally (the subset of the D1 / Rate Limiting APIs this Worker
 * uses) so the same code runs on Cloudflare and inside the Node test suite, where D1 is
 * replaced by an in-memory SQLite adapter.
 */

export interface D1Result<T> {
  results: T[];
  success: boolean;
  meta: { changes?: number; last_row_id?: number };
}

export interface D1Statement {
  bind(...values: (string | number | null)[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<D1Result<Record<string, unknown>>>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

export interface D1Like {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<D1Result<Record<string, unknown>>[]>;
}

export interface RateLimiterLike {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  DB: D1Like;
  CHECKOUT_LIMITER?: RateLimiterLike;
  LOOKUP_LIMITER?: RateLimiterLike;
  LOGIN_LIMITER?: RateLimiterLike;

  // Secrets (wrangler secret put)
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  TELEGRAM_BOT_TOKEN?: string;

  // Vars (wrangler.jsonc)
  STRIPE_TEST_MODE?: string;
  PAYMENTS_LIVE_ENABLED?: string;
  /** "manual" (default): every payment method must support authorise-then-capture.
   *  "per-method": card/Link/wallets are authorised; methods without manual capture are
   *  charged at once and refunded if the restaurant rejects. */
  STRIPE_CAPTURE_MODE?: string;
  /** Per-request timeout for Stripe API calls in ms (default 15000). */
  STRIPE_TIMEOUT_MS?: string;
  /** Seconds after which an accept/reject lock is considered abandoned (default 90). */
  LOCK_STALE_SECONDS?: string;
  /** Seconds after which a lock Stripe cannot resolve goes to review (default 300). */
  LOCK_REVIEW_SECONDS?: string;
  CORS_ALLOWED_ORIGIN?: string;
  STRIPE_SUCCESS_URL?: string;
  STRIPE_CANCEL_URL?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  /** Comma-separated Telegram chat ids allowed to receive order alerts. */
  TELEGRAM_CHAT_IDS?: string;
  /** Public URL of the staff panel (the button in Telegram alerts opens it). */
  PANEL_URL?: string;
  /** Preparation times offered to staff when accepting, e.g. "15,20,30,45". */
  PREP_TIME_OPTIONS?: string;
  /** Minutes without a decision before a reminder alert (0 = never). */
  ACCEPTANCE_REMINDER_MINUTES?: string;
  /** Minutes without a decision before the order is declined and the hold released (0 = never). */
  ACCEPTANCE_TIMEOUT_MINUTES?: string;
  /** "all" (default), "api" (storefront API + webhook + cron) or "panel" (staff panel only). */
  WORKER_ROLE?: string;

  // Local end-to-end stack only. Ignored unless test mode is on AND the URL is localhost.
  STRIPE_API_BASE?: string;
  TELEGRAM_API_BASE?: string;
  ACCESS_CERTS_URL?: string;
}

export type JwksCache = Map<string, { keys: JsonWebKeyWithKid[]; fetchedAt: number }>;

export type JsonWebKeyWithKid = JsonWebKey & { kid?: string };

export interface Deps {
  fetch: typeof fetch;
  now: () => Date;
  jwksCache: JwksCache;
  /** Work allowed to finish after the response (ctx.waitUntil on Cloudflare). */
  waitUntil: (promise: Promise<unknown>) => void;
}

const sharedJwksCache: JwksCache = new Map();

export function defaultDeps(ctx?: { waitUntil(promise: Promise<unknown>): void }): Deps {
  return {
    fetch: (input, init) => fetch(input, init),
    now: () => new Date(),
    jwksCache: sharedJwksCache,
    waitUntil: (promise) => {
      const guarded = promise.catch(() => undefined);
      if (ctx) ctx.waitUntil(guarded);
    },
  };
}
