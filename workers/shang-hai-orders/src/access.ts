import { base64UrlDecode } from "./crypto";
import type { Deps, JsonWebKeyWithKid } from "./env";

/**
 * Cloudflare Access JWT validation for the staff panel.
 * Access sits in front of /admin and /api/admin/* and forwards a signed JWT in the
 * Cf-Access-Jwt-Assertion header. We verify it ourselves (RS256 against the team's JWKS,
 * aud = application AUD tag, iss = team domain, exp/nbf) so a misconfigured route can
 * never expose orders.
 */

const JWKS_TTL_MS = 10 * 60 * 1000;
const CLOCK_SKEW_SECONDS = 30;

export type AccessIdentity = { email: string | null; subject: string };

export type AccessCheck =
  | { ok: true; identity: AccessIdentity }
  | { ok: false; status: 401 | 403; reason: string };

type JwtHeader = { alg?: string; kid?: string; typ?: string };
type JwtPayload = {
  aud?: string | string[];
  iss?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  sub?: string;
  email?: string;
};

function decodeJson<T>(segment: string): T | null {
  const bytes = base64UrlDecode(segment);
  if (!bytes) return null;
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
}

async function loadKeys(teamDomain: string, deps: Deps, force: boolean): Promise<JsonWebKeyWithKid[]> {
  const url = `https://${teamDomain}/cdn-cgi/access/certs`;
  const cached = deps.jwksCache.get(url);
  if (!force && cached && deps.now().getTime() - cached.fetchedAt < JWKS_TTL_MS) return cached.keys;
  try {
    const res = await deps.fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return cached?.keys ?? [];
    const body = (await res.json()) as { keys?: JsonWebKeyWithKid[] };
    const keys = Array.isArray(body.keys) ? body.keys : [];
    deps.jwksCache.set(url, { keys, fetchedAt: deps.now().getTime() });
    return keys;
  } catch {
    return cached?.keys ?? [];
  }
}

export async function verifyAccessJwt(
  token: string | null,
  config: { teamDomain: string; aud: string },
  deps: Deps,
): Promise<AccessCheck> {
  if (!token) return { ok: false, status: 401, reason: "missing-token" };
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, status: 403, reason: "malformed-token" };
  const [headerB64, payloadB64, signatureB64] = parts;
  const header = decodeJson<JwtHeader>(headerB64);
  const payload = decodeJson<JwtPayload>(payloadB64);
  const signature = base64UrlDecode(signatureB64);
  if (!header || !payload || !signature) return { ok: false, status: 403, reason: "malformed-token" };
  if (header.alg !== "RS256" || !header.kid) return { ok: false, status: 403, reason: "unsupported-alg" };

  let keys = await loadKeys(config.teamDomain, deps, false);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    // Keys rotate: refresh once when an unknown kid shows up.
    keys = await loadKeys(config.teamDomain, deps, true);
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) return { ok: false, status: 403, reason: "unknown-key" };

  let valid = false;
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      signature,
      new TextEncoder().encode(`${headerB64}.${payloadB64}`),
    );
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, status: 403, reason: "bad-signature" };

  const now = Math.floor(deps.now().getTime() / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
  if (!audiences.includes(config.aud)) return { ok: false, status: 403, reason: "wrong-audience" };
  if (payload.iss !== `https://${config.teamDomain}`) return { ok: false, status: 403, reason: "wrong-issuer" };
  if (typeof payload.exp !== "number" || payload.exp + CLOCK_SKEW_SECONDS < now) {
    return { ok: false, status: 403, reason: "expired" };
  }
  if (typeof payload.nbf === "number" && payload.nbf - CLOCK_SKEW_SECONDS > now) {
    return { ok: false, status: 403, reason: "not-yet-valid" };
  }
  return {
    ok: true,
    identity: { email: typeof payload.email === "string" ? payload.email : null, subject: payload.sub ?? "" },
  };
}
