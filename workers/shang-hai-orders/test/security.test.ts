import { describe, expect, it } from "vitest";
import type { RateLimiterLike } from "../src/env";
import {
  call,
  CHECKOUT_TOTAL,
  createOrder,
  placedOrder,
  postJson,
  staffCookie,
  STOREFRONT_ORIGIN,
  validCheckout,
  world,
  WORKER_ORIGIN,
  type World,
} from "./helpers";

/**
 * Negative security tests (2026-11-06 audit). Each describe states the property; the first
 * block pins the fixes for the staff sign-in findings (SEC-01..03), the rest pin controls the
 * audit verified as solid so they cannot regress silently.
 */

const codeFrom = (text: string | null) => /\b(\d{6})\b/.exec(text ?? "")?.[1] ?? "";

function limiter(limit = 1000): RateLimiterLike {
  const hits = new Map<string, number>();
  return {
    async limit({ key }) {
      const n = (hits.get(key) ?? 0) + 1;
      hits.set(key, n);
      return { success: n <= limit };
    },
  };
}

function requestCode(w: World, headers: Record<string, string> = { Origin: WORKER_ORIGIN }) {
  return call(w.env, w.deps, "/api/admin/auth/code", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.7", ...headers },
    body: "{}",
  });
}

function verify(w: World, code: string) {
  return call(w.env, w.deps, "/api/admin/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: WORKER_ORIGIN, "CF-Connecting-IP": "203.0.113.7" },
    body: JSON.stringify({ code, label: "device" }),
  });
}

const attemptsOfLatestCode = (w: World) =>
  Number((w.env.DB.raw.prepare("SELECT attempts FROM staff_login_codes ORDER BY id DESC LIMIT 1").get() as { attempts: number }).attempts);

describe("staff sign-in codes", () => {
  it("SEC-01: ten simultaneous wrong guesses spend at most five attempts, and the code is then burnt", async () => {
    const w = world({ LOGIN_LIMITER: limiter() });
    expect((await requestCode(w)).status).toBe(202);
    const code = codeFrom(w.telegram.lastText());
    const wrong = code === "000000" ? "111111" : "000000";
    const results = await Promise.all(Array.from({ length: 10 }, () => verify(w, wrong)));
    expect(results.every((r) => r.status === 401)).toBe(true);
    expect(attemptsOfLatestCode(w)).toBe(5);
    // Even the right code no longer works: request a new one.
    expect((await verify(w, code)).status).toBe(401);
  });

  it("SEC-02: simultaneous code requests send exactly one code", async () => {
    const w = world({ LOGIN_LIMITER: limiter() });
    const statuses = (await Promise.all(Array.from({ length: 6 }, () => requestCode(w)))).map((r) => r.status).sort();
    expect(statuses).toEqual([202, 429, 429, 429, 429, 429]);
    expect(Number((w.env.DB.raw.prepare("SELECT COUNT(*) AS n FROM staff_login_codes").get() as { n: number }).n)).toBe(1);
    expect(w.telegram.messages()).toHaveLength(2); // one per authorised chat
  });

  it("SEC-02: code requests go through the per-IP limiter", async () => {
    const w = world({ LOGIN_LIMITER: limiter(0) });
    expect((await requestCode(w)).status).toBe(429);
    expect(w.telegram.messages()).toHaveLength(0);
  });

  it("SEC-03: a request without Origin (not the panel) or from another site cannot trigger codes", async () => {
    const w = world({ LOGIN_LIMITER: limiter() });
    expect((await requestCode(w, {})).status).toBe(403);
    expect((await requestCode(w, { Origin: "https://evil.example" })).status).toBe(403);
    expect((await requestCode(w, { Origin: "null" })).status).toBe(403);
    expect(w.telegram.messages()).toHaveLength(0);
  });

  it("a new code replaces the previous one; a used code cannot be reused", async () => {
    const w = world({ LOGIN_LIMITER: limiter() });
    await requestCode(w);
    const first = codeFrom(w.telegram.lastText());
    w.advance(31_000);
    await requestCode(w);
    const second = codeFrom(w.telegram.lastText());
    if (first !== second) expect((await verify(w, first)).status).toBe(401);
    expect((await verify(w, second)).status).toBe(200);
    expect((await verify(w, second)).status).toBe(401);
  });

  it("an expired code is refused", async () => {
    const w = world({ LOGIN_LIMITER: limiter() });
    await requestCode(w);
    const code = codeFrom(w.telegram.lastText());
    w.advance(10 * 60_000 + 1_000);
    expect((await verify(w, code)).status).toBe(401);
  });

  it("the code message carries no customer data and nothing but the code and a warning", async () => {
    const w = world({ LOGIN_LIMITER: limiter() });
    await placedOrder(w); // an order with a name, phone and email exists
    const before = w.telegram.messages().length;
    await requestCode(w);
    for (const m of w.telegram.messages().slice(before)) {
      expect(m.text).not.toMatch(/Lucía|612|lucia@/);
      expect(m.button).toBeNull();
    }
  });
});

describe("staff routes: CSRF and access", () => {
  async function accept(w: World, cookie: string, headers: Record<string, string>) {
    const order = await placedOrder(w);
    return (
      await call(w.env, w.deps, `/api/admin/orders/${order.orderId}/accept`, {
        method: "POST",
        headers: { Cookie: cookie, ...headers },
        body: JSON.stringify({ prepMinutes: 20 }),
      })
    ).status;
  }

  it("refuses cross-site, Origin-less and non-JSON mutations; same-origin JSON passes", async () => {
    const w = world();
    const cookie = await staffCookie(w.env, "A", w.now());
    expect(await accept(w, cookie, { Origin: "https://evil.example", "Content-Type": "application/json" })).toBe(403);
    expect(await accept(w, cookie, { "Content-Type": "application/json" })).toBe(403);
    expect(await accept(w, cookie, { Origin: WORKER_ORIGIN, "Content-Type": "text/plain" })).toBe(415);
    expect(await accept(w, cookie, { Origin: WORKER_ORIGIN, "Content-Type": "application/x-www-form-urlencoded" })).toBe(415);
    expect(await accept(w, cookie, { Origin: WORKER_ORIGIN, "Content-Type": "application/json" })).toBe(200);
  });

  it("needs a valid session: none, forged or revoked → 401", async () => {
    const w = world();
    const order = await placedOrder(w);
    const post = (cookie?: string) =>
      call(w.env, w.deps, `/api/admin/orders/${order.orderId}/accept`, {
        method: "POST",
        headers: { Origin: WORKER_ORIGIN, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
        body: JSON.stringify({ prepMinutes: 20 }),
      });
    expect((await post()).status).toBe(401);
    expect((await post("__Host-shp_session=forged-token-value-forged-token-value")).status).toBe(401);
    const cookie = await staffCookie(w.env, "B", w.now());
    w.env.DB.raw.prepare("UPDATE staff_sessions SET revoked_at = ?").run(w.now().toISOString());
    expect((await post(cookie)).status).toBe(401);
  });

  it("the admin API is never CORS-enabled", async () => {
    const w = world();
    const pre = await call(w.env, w.deps, "/api/admin/board", { method: "OPTIONS", headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "GET" } });
    expect(pre.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("storefront API", () => {
  it("reflects only allow-listed origins and never advertises credentials", async () => {
    const w = world();
    const evil = await call(w.env, w.deps, "/api/health", { headers: { Origin: "https://evil.example" } });
    const ok = await call(w.env, w.deps, "/api/health", { headers: { Origin: STOREFRONT_ORIGIN } });
    expect(evil.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(ok.headers.get("Access-Control-Allow-Origin")).toBe(STOREFRONT_ORIGIN);
    expect(ok.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });

  it("prices only on the server: client-sent prices are ignored", async () => {
    const w = world();
    const res = await postJson(w.env, w.deps, "/api/checkout", {
      ...validCheckout({ expectedTotalCents: undefined }),
      lines: [{ itemId: "combo-a", quantity: 1, unitPriceCents: 1, lineTotalCents: 1, name: "FREE", priceCents: 0 }],
    });
    expect(res.status).toBe(201);
    const amounts = w.net.stripeCalls
      .filter((c) => /\/checkout\/sessions$/.test(c.url))
      .flatMap((c) => [...c.form.entries()].filter(([k]) => /unit_amount/.test(k)).map(([, v]) => v));
    expect(amounts).toEqual(["1945"]);
  });

  it("refuses negative, zero, fractional, huge and non-numeric quantities", async () => {
    const w = world();
    for (const quantity of [-5, 0, 1.5, 21, 999999, Number.MAX_SAFE_INTEGER, "2", null]) {
      const res = await postJson(w.env, w.deps, "/api/checkout", validCheckout({ lines: [{ itemId: "combo-a", quantity }], expectedTotalCents: undefined }));
      expect(res.status, `quantity ${String(quantity)}`).toBe(422);
    }
  });

  it("refuses unknown and non-orderable items, alcohol without age confirmation and delivery (disabled)", async () => {
    const w = world();
    const post = (o: Record<string, unknown>) => postJson(w.env, w.deps, "/api/checkout", validCheckout({ expectedTotalCents: undefined, ...o }));
    expect((await post({ lines: [{ itemId: "does-not-exist", quantity: 1 }] })).status).toBe(422);
    expect((await post({ lines: [{ itemId: "sashimi-de-atun", quantity: 1 }] })).status).toBe(422);
    const age = await post({ lines: [{ itemId: "vino-tinto-marques-de-caceres", quantity: 1 }], ageConfirmed: false });
    expect(age.status).toBe(422);
    expect((await age.json()) as Record<string, unknown>).toMatchObject({ error: "age-confirmation-required" });
    expect((await post({ fulfillment: "delivery", delivery: { street: "Calle Mayor 1", postalCode: "03300", city: "Orihuela" } })).status).toBe(422);
  });

  it("answers a stale total with 409 and the server's total, and caps the body at 16 KB", async () => {
    const w = world();
    const stale = await postJson(w.env, w.deps, "/api/checkout", validCheckout({ expectedTotalCents: 1 }));
    expect(stale.status).toBe(409);
    expect(((await stale.json()) as { totalCents: number }).totalCents).toBe(CHECKOUT_TOTAL);
    const huge = await postJson(w.env, w.deps, "/api/checkout", validCheckout({ customer: { name: "x".repeat(17 * 1024), phone: "612345678", email: "a@b.es" } }));
    expect(huge.status).toBe(413);
  });

  it("order tracking: same 404 for a wrong token and a missing order; no personal data in the answer", async () => {
    const w = world();
    const a = await createOrder(w);
    const b = await createOrder(w);
    const get = (id: string, token?: string) => call(w.env, w.deps, `/api/orders/${id}`, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
    const good = await get(a.orderId, a.orderToken);
    expect(good.status).toBe(200);
    expect((await get(a.orderId, b.orderToken)).status).toBe(404);
    expect((await get("SH-261029-ZZZZZZ", a.orderToken)).status).toBe(404);
    expect((await get(a.orderId)).status).toBe(401);
    const text = JSON.stringify(await good.json());
    expect(text).not.toContain("612 345 678");
    expect(text.toLowerCase()).not.toContain("lucia@example.es");
    expect(text).not.toContain("Sin cebolla");
  });

  it("security headers on every API answer", async () => {
    const w = world();
    const res = await call(w.env, w.deps, "/api/health");
    for (const [h, v] of [
      ["X-Content-Type-Options", "nosniff"],
      ["Referrer-Policy", "no-referrer"],
      ["X-Frame-Options", "DENY"],
      ["Cache-Control", "no-store"],
    ]) {
      expect(res.headers.get(h)).toBe(v);
    }
  });
});
