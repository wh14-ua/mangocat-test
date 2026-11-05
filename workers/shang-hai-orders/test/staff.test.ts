import { beforeAll, describe, expect, it } from "vitest";
import {
  ACCESS_AUD,
  accessKeys,
  call,
  count,
  createOrder,
  customerView,
  fakeNetwork,
  makeDeps,
  makeEnv,
  placedOrder,
  runCron,
  signAccessJwt,
  staffAction,
  staffCall,
  staffCookie,
  TEAM_DOMAIN,
  world,
  WORKER_ORIGIN,
  type World,
} from "./helpers";

async function requestCode(w: World) {
  const res = await call(w.env, w.deps, "/api/admin/auth/code", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: WORKER_ORIGIN },
    body: "{}",
  });
  return res;
}

async function verify(w: World, code: string, label = "Móvil de Pedro") {
  return call(w.env, w.deps, "/api/admin/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: WORKER_ORIGIN },
    body: JSON.stringify({ code, label }),
  });
}

const codeFrom = (text: string | null) => /\b(\d{6})\b/.exec(text ?? "")?.[1] ?? "";

describe("staff sign-in with a Telegram code", () => {
  it("sends a code only to the authorised chats and opens an HttpOnly session with it", async () => {
    const w = world();
    expect((await call(w.env, w.deps, "/api/admin/board")).status).toBe(401);
    const sent = await requestCode(w);
    expect(sent.status).toBe(202);
    const messages = w.telegram.messages();
    expect(messages.map((m) => m.chat_id).sort()).toEqual(["-1002222222222", "111111111"]);
    const code = codeFrom(w.telegram.lastText());
    expect(code).toMatch(/^\d{6}$/);

    const ok = await verify(w, code);
    expect(ok.status).toBe(200);
    const cookie = ok.headers.get("Set-Cookie") ?? "";
    expect(cookie).toMatch(/^__Host-shp_session=[A-Za-z0-9_-]{43}; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000$/);
    const session = cookie.split(";")[0];
    const me = await staffCall(w, session, "/api/admin/session");
    expect(await me.json()).toMatchObject({ authenticated: true, method: "telegram-code", label: "Móvil de Pedro" });
    // Single use.
    expect((await verify(w, code)).status).toBe(401);
    // Only hashes are stored.
    const stored = JSON.stringify(w.env.DB.raw.prepare("SELECT * FROM staff_login_codes").all());
    expect(stored).not.toContain(code);
  });

  it("limits wrong codes, code requests and works only with Telegram configured", async () => {
    const w = world();
    await requestCode(w);
    const code = codeFrom(w.telegram.lastText());
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect((await verify(w, wrong)).status).toBe(401);
    expect((await verify(w, code)).status).toBe(401); // burnt after 5 wrong tries
    expect((await requestCode(w)).status).toBe(429); // too soon for another code
    w.advance(31_000);
    expect((await requestCode(w)).status).toBe(202);

    const closed = makeEnv({ TELEGRAM_BOT_TOKEN: "", ACCESS_AUD: "", ACCESS_TEAM_DOMAIN: "" });
    const deps = makeDeps(fakeNetwork().fetch);
    expect((await call(closed, deps, "/api/admin/board")).status).toBe(503);
  });

  it("expires codes after 10 minutes and refuses cross-site requests", async () => {
    const w = world();
    await requestCode(w);
    const code = codeFrom(w.telegram.lastText());
    w.advance(11 * 60_000);
    expect((await verify(w, code)).status).toBe(401);
    const csrf = await call(w.env, w.deps, "/api/admin/auth/code", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
      body: "{}",
    });
    expect(csrf.status).toBe(403);
  });

  it("logs out this device or every device", async () => {
    const w = world();
    const a = await staffCookie(w.env, "A", w.now());
    const b = await staffCookie(w.env, "B", w.now());
    await staffCall(w, a, "/api/admin/auth/logout", { method: "POST", body: "{}" });
    expect((await staffCall(w, a, "/api/admin/board")).status).toBe(401);
    expect((await staffCall(w, b, "/api/admin/board")).status).toBe(200);
    await staffCall(w, b, "/api/admin/auth/logout", { method: "POST", body: JSON.stringify({ everywhere: true }) });
    expect((await staffCall(w, b, "/api/admin/board")).status).toBe(401);
  });

  it("refuses staff actions from another origin even with a valid session", async () => {
    const w = world();
    const order = await placedOrder(w);
    const cookie = await staffCookie(w.env, "A", w.now());
    const res = await call(w.env, w.deps, `/api/admin/orders/${order.orderId}/accept`, {
      method: "POST",
      headers: { Cookie: cookie, Origin: "https://evil.example", "Content-Type": "application/json" },
      body: JSON.stringify({ prepMinutes: 20 }),
    });
    expect(res.status).toBe(403);
    expect((await customerView(w, order)).status).toBe("awaiting_acceptance");
  });
});

describe("staff sign-in with Cloudflare Access", () => {
  let keys: Awaited<ReturnType<typeof accessKeys>>;
  beforeAll(async () => {
    keys = await accessKeys("test-kid");
  });

  it("accepts a valid Access JWT (header or cookie) and rejects forged ones", async () => {
    const env = makeEnv({ ACCESS_TEAM_DOMAIN: TEAM_DOMAIN, ACCESS_AUD, TELEGRAM_BOT_TOKEN: "" });
    const deps = makeDeps(fakeNetwork({ jwks: [keys.jwk] }).fetch);
    const jwt = await signAccessJwt(keys.privateKey);
    const viaHeader = await call(env, deps, "/api/admin/session", { headers: { "Cf-Access-Jwt-Assertion": jwt } });
    expect(await viaHeader.json()).toMatchObject({ method: "access", label: "cocina@shanghai.example" });
    expect((await call(env, deps, "/api/admin/session", { headers: { Cookie: `CF_Authorization=${jwt}` } })).status).toBe(200);
    const wrongAud = await signAccessJwt(keys.privateKey, { aud: ["other"] });
    expect((await call(env, deps, "/api/admin/board", { headers: { "Cf-Access-Jwt-Assertion": wrongAud } })).status).toBe(401);
    const expired = await signAccessJwt(keys.privateKey, { exp: 1 });
    expect((await call(env, deps, "/api/admin/board", { headers: { "Cf-Access-Jwt-Assertion": expired } })).status).toBe(401);
  });
});

describe("staff board", () => {
  it("groups orders in the five columns with the card details and allowed buttons", async () => {
    const w = world();
    const cookie = await staffCookie(w.env, "A", w.now());
    const fresh = await placedOrder(w);
    const cooking = await placedOrder(w, { storefront: "bento-club" });
    await staffAction(w, cookie, cooking.orderId, "accept", { prepMinutes: 20 });
    const declined = await placedOrder(w, { storefront: "wok-after-dark" });
    await staffAction(w, cookie, declined.orderId, "reject", { reason: "Cerrado" });
    await createOrder(w); // unpaid checkout: never shown to the restaurant

    const board = (await (await staffCall(w, cookie, "/api/admin/board")).json()) as {
      columns: Record<string, { id: string; actions: string[]; customer: Record<string, string>; lines: unknown[]; notes: string; alert: string }[]>;
      prepOptions: number[];
      health: { telegram: { configured: boolean } };
    };
    expect(board.columns.new.map((o) => o.id)).toEqual([fresh.orderId]);
    expect(board.columns.preparing.map((o) => o.id)).toEqual([cooking.orderId]);
    expect(board.columns.rejected.map((o) => o.id)).toEqual([declined.orderId]);
    const card = board.columns.new[0];
    expect(card.actions).toEqual(["accept", "reject"]);
    expect(card.customer).toMatchObject({ name: "Lucía García", phoneDisplay: "612 345 678" });
    expect(card.notes).toBe("Sin cebolla");
    expect(card.lines).toHaveLength(2);
    expect(card.alert).toBe("sent");
    expect(board.columns.preparing[0].actions).toEqual(["ready", "reject"]);
    expect(board.prepOptions).toEqual([15, 20, 30, 45]);
    expect(board.health.telegram.configured).toBe(true);

    const detail = (await (await staffCall(w, cookie, `/api/admin/orders/${fresh.orderId}`)).json()) as { order: { events: unknown[]; notifications: unknown[]; email: string } };
    expect(detail.order.email).toBe("lucia@example.es");
    expect(detail.order.events.length).toBeGreaterThan(0);
    expect(detail.order.notifications).toHaveLength(2);
  });

  it("uses the preparation times configured for the restaurant", async () => {
    const w = world({ PREP_TIME_OPTIONS: "10, 25, 40, 999, x" });
    const cookie = await staffCookie(w.env, "A", w.now());
    const board = (await (await staffCall(w, cookie, "/api/admin/board")).json()) as { prepOptions: number[] };
    expect(board.prepOptions).toEqual([10, 25, 40]);
  });
});

describe("notification failures never lose an order", () => {
  it("retries a rate-limited alert later, records failures, and the panel still lists the order", async () => {
    const w = world();
    w.telegram.failNext({ status: 429, retryAfter: 20 });
    w.telegram.failNext({ network: true });
    const order = await placedOrder(w);
    const cookie = await staffCookie(w.env, "A", w.now());
    // Both first attempts failed, but the order is on the board anyway.
    const board = (await (await staffCall(w, cookie, "/api/admin/board")).json()) as { columns: { new: { id: string; alert: string }[] } };
    expect(board.columns.new[0]).toMatchObject({ id: order.orderId, alert: "pending" });
    expect(count(w.env, "SELECT COUNT(*) AS n FROM notifications WHERE status = 'failed' AND next_attempt_at IS NOT NULL")).toBe(2);

    w.advance(70_000);
    await runCron(w);
    expect(count(w.env, "SELECT COUNT(*) AS n FROM notifications WHERE status = 'sent'")).toBe(2);
    expect(w.telegram.messages()).toHaveLength(2); // no duplicates
  });

  it("stops retrying a chat that blocked the bot and shows it in the health box", async () => {
    const w = world();
    w.telegram.failNext({ status: 403 });
    await placedOrder(w);
    w.advance(60 * 60_000);
    await runCron(w);
    expect(count(w.env, "SELECT COUNT(*) AS n FROM notifications WHERE status = 'failed' AND next_attempt_at IS NULL")).toBe(1);
    const cookie = await staffCookie(w.env, "A", w.now());
    const board = (await (await staffCall(w, cookie, "/api/admin/board")).json()) as { health: { telegram: { lastError: string; failedLast24h: number } } };
    expect(board.health.telegram.lastError).toContain("blocked");
    expect(board.health.telegram.failedLast24h).toBe(1);
  });

  it("works without Telegram at all: orders still reach the panel", async () => {
    const w = world({ TELEGRAM_BOT_TOKEN: "", TELEGRAM_CHAT_IDS: "" });
    const order = await placedOrder(w);
    expect(w.telegram.messages()).toHaveLength(0);
    expect((await customerView(w, order)).status).toBe("awaiting_acceptance");
  });
});

describe("customer order lookup", () => {
  it("requires the order token and hides contact details, notes and Stripe ids", async () => {
    const w = world();
    const order = await placedOrder(w);
    const path = `/api/orders/${order.orderId}`;
    expect((await call(w.env, w.deps, path)).status).toBe(401);
    expect((await call(w.env, w.deps, path, { headers: { Authorization: `Bearer ${"x".repeat(43)}` } })).status).toBe(404);
    expect((await call(w.env, w.deps, "/api/orders/%E0%A4%A", { headers: { Authorization: `Bearer ${order.orderToken}` } })).status).toBe(404);
    const view = await customerView(w, order);
    expect(view).toMatchObject({ id: order.orderId, number: order.orderNumber, status: "awaiting_acceptance", paymentStatus: "authorized" });
    const text = JSON.stringify(view);
    for (const secret of ["612345678", "lucia@example.es", "Sin cebolla", "cs_test_", "pi_test_"]) expect(text).not.toContain(secret);
  });
});
