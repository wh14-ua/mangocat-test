import { beforeAll, describe, expect, it } from "vitest";
import {
  ACCESS_AUD,
  accessKeys,
  call,
  createOrder,
  fakeNetwork,
  makeDeps,
  makeEnv,
  NOW,
  orderRow,
  signAccessJwt,
  TEAM_DOMAIN,
  type TestEnv,
} from "./helpers";

describe("GET /api/orders/:id", () => {
  it("requires the order token and hides contact details", async () => {
    const env = makeEnv();
    const order = await createOrder(env);
    const deps = makeDeps(fakeNetwork().fetch);
    const path = `/api/orders/${order.orderId}`;

    expect((await call(env, deps, path)).status).toBe(401);
    const wrong = await call(env, deps, path, { headers: { Authorization: `Bearer ${"x".repeat(43)}` } });
    expect(wrong.status).toBe(404);
    const unknown = await call(env, deps, "/api/orders/SH-261029-ZZZZZZ", {
      headers: { Authorization: `Bearer ${order.orderToken}` },
    });
    expect(unknown.status).toBe(404);
    const bad = await call(env, deps, "/api/orders/%E0%A4%A", { headers: { Authorization: `Bearer ${order.orderToken}` } });
    expect(bad.status).toBe(404);

    const ok = await call(env, deps, path, { headers: { Authorization: `Bearer ${order.orderToken}` } });
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { order: Record<string, unknown> };
    expect(body.order).toMatchObject({
      id: order.orderId,
      status: "pending",
      totalCents: 2 * 1945 + 765,
      currency: "EUR",
      fulfillment: "pickup",
      mode: "stripe-test",
      customerName: "Lucía García",
      pickupNote: "El restaurante confirmará la hora de recogida.",
    });
    const text = JSON.stringify(body);
    expect(text).not.toContain("612345678");
    expect(text).not.toContain("lucia@example.es");
    expect(text).not.toContain("Sin cebolla");
    expect(text).not.toContain("cs_test_");
  });
});

describe("Staff panel (Cloudflare Access)", () => {
  let keys: Awaited<ReturnType<typeof accessKeys>>;
  let otherKeys: Awaited<ReturnType<typeof accessKeys>>;
  const accessEnv = () => makeEnv({ ACCESS_TEAM_DOMAIN: TEAM_DOMAIN, ACCESS_AUD });

  beforeAll(async () => {
    keys = await accessKeys("test-kid");
    otherKeys = await accessKeys("test-kid");
  });

  const staffDeps = () => makeDeps(fakeNetwork({ jwks: [keys.jwk] }).fetch);

  async function asStaff(env: TestEnv, path: string, init: RequestInit = {}, claims = {}) {
    const jwt = await signAccessJwt(keys.privateKey, claims);
    return call(env, staffDeps(), path, {
      ...init,
      headers: { "Cf-Access-Jwt-Assertion": jwt, ...(init.headers ?? {}) },
    });
  }

  const setStatus = (env: TestEnv, id: string, status: string) =>
    asStaff(env, `/api/admin/orders/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

  it("is closed (503) until Access is configured", async () => {
    const env = makeEnv();
    for (const path of ["/admin", "/api/admin/orders"]) {
      const res = await call(env, makeDeps(fakeNetwork().fetch), path);
      expect(res.status).toBe(503);
    }
  });

  it("rejects missing (401) and invalid (403) Access tokens", async () => {
    const env = accessEnv();
    expect((await call(env, staffDeps(), "/api/admin/orders")).status).toBe(401);
    const forged = await signAccessJwt(otherKeys.privateKey);
    const cases = [
      forged,
      await signAccessJwt(keys.privateKey, { aud: ["another-app"] }),
      await signAccessJwt(keys.privateKey, { iss: "https://evil.cloudflareaccess.com" }),
      await signAccessJwt(keys.privateKey, { exp: Math.floor(NOW.getTime() / 1000) - 3600 }),
      await signAccessJwt(keys.privateKey, { nbf: Math.floor(NOW.getTime() / 1000) + 3600 }),
      await signAccessJwt(keys.privateKey, {}, "unknown-kid"),
      "not.a.jwt",
    ];
    for (const jwt of cases) {
      const res = await call(env, staffDeps(), "/api/admin/orders", { headers: { "Cf-Access-Jwt-Assertion": jwt } });
      expect(res.status).toBe(403);
    }
  });

  it("serves the panel with a strict CSP", async () => {
    const res = await asStaff(accessEnv(), "/admin");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    const nonce = /script-src 'nonce-([A-Za-z0-9_-]+)'/.exec(csp)?.[1];
    expect(nonce).toBeTruthy();
    const html = await res.text();
    expect(html).toContain(`<script nonce="${nonce}">`);
    expect(html).not.toMatch(/https?:\/\/(?!www\.w3)/);
  });

  it("lists orders and moves them through the kitchen states", async () => {
    const env = accessEnv();
    const order = await createOrder(env);
    // Payment confirmation comes only from Stripe; staff cannot mark an order as paid.
    expect((await setStatus(env, order.orderId, "paid")).status).toBe(422);
    // Kitchen states are not reachable while the order is unpaid.
    expect((await setStatus(env, order.orderId, "preparing")).status).toBe(409);

    env.DB.raw.prepare("UPDATE orders SET status = 'paid' WHERE id = ?").run(order.orderId);
    const list = await asStaff(env, "/api/admin/orders?status=paid");
    expect(list.status).toBe(200);
    const listed = (await list.json()) as { orders: { id: string; customerName: string }[] };
    expect(listed.orders.map((o) => o.id)).toEqual([order.orderId]);

    const detail = await asStaff(env, `/api/admin/orders/${order.orderId}`);
    const body = (await detail.json()) as { order: { customer: { phone: string }; lines: unknown[] } };
    expect(body.order.customer.phone).toBe("+34612345678");
    expect(body.order.lines).toHaveLength(2);

    expect((await setStatus(env, order.orderId, "ready")).status).toBe(409); // no skipping
    for (const status of ["preparing", "ready", "completed"]) {
      const res = await setStatus(env, order.orderId, status);
      expect(res.status).toBe(200);
      expect(orderRow(env, order.orderId)?.status).toBe(status);
    }
    expect((await setStatus(env, order.orderId, "cancelled")).status).toBe(409); // completed is final
    const events = env.DB.raw
      .prepare("SELECT to_status, source, actor FROM order_events WHERE order_id = ? AND source = 'staff' ORDER BY id")
      .all(order.orderId);
    expect(events.map((e) => ({ ...e }))).toEqual([
      { to_status: "preparing", source: "staff", actor: "cocina@shanghai.example" },
      { to_status: "ready", source: "staff", actor: "cocina@shanghai.example" },
      { to_status: "completed", source: "staff", actor: "cocina@shanghai.example" },
    ]);
  });

  it("blocks cross-site status changes", async () => {
    const env = accessEnv();
    const order = await createOrder(env);
    env.DB.raw.prepare("UPDATE orders SET status = 'paid' WHERE id = ?").run(order.orderId);
    const res = await asStaff(env, `/api/admin/orders/${order.orderId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
      body: JSON.stringify({ status: "preparing" }),
    });
    expect(res.status).toBe(403);
    const form = await asStaff(env, `/api/admin/orders/${order.orderId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "status=preparing",
    });
    expect(form.status).toBe(415);
    expect(orderRow(env, order.orderId)?.status).toBe("paid");
  });
});
