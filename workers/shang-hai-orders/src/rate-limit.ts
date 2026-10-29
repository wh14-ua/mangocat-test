import type { RateLimiterLike } from "./env";

/**
 * Workers Rate Limiting binding wrapper. Without a binding (local tests) every request is
 * allowed; if the binding itself errors we fail open rather than block real customers.
 */
export async function allow(limiter: RateLimiterLike | undefined, key: string): Promise<boolean> {
  if (!limiter) return true;
  try {
    return (await limiter.limit({ key })).success;
  } catch {
    return true;
  }
}
