import type { RateLimiterLike } from "./env";
import { log } from "./log";

/**
 * Workers Rate Limiting binding wrapper. Without a binding (unit tests) every request is
 * allowed; if the binding itself errors we fail open rather than block real customers — and
 * say so in the logs, so a silently missing limiter is visible.
 */
export async function allow(limiter: RateLimiterLike | undefined, key: string): Promise<boolean> {
  if (!limiter) return true;
  try {
    return (await limiter.limit({ key })).success;
  } catch (error) {
    log("ratelimit.unavailable", { scope: key.split(":")[0], message: error instanceof Error ? error.message : "unknown" });
    return true;
  }
}
