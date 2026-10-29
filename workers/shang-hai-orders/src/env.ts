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

  // Secrets (wrangler secret put)
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;

  // Vars (wrangler.jsonc)
  STRIPE_TEST_MODE?: string;
  PAYMENTS_LIVE_ENABLED?: string;
  CORS_ALLOWED_ORIGIN?: string;
  STRIPE_SUCCESS_URL?: string;
  STRIPE_CANCEL_URL?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
}

export type JwksCache = Map<string, { keys: JsonWebKeyWithKid[]; fetchedAt: number }>;

export type JsonWebKeyWithKid = JsonWebKey & { kid?: string };

export interface Deps {
  fetch: typeof fetch;
  now: () => Date;
  jwksCache: JwksCache;
}

const sharedJwksCache: JwksCache = new Map();

export function defaultDeps(): Deps {
  return {
    fetch: (input, init) => fetch(input, init),
    now: () => new Date(),
    jwksCache: sharedJwksCache,
  };
}
