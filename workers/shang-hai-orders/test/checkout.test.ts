import { describe, expect, it } from "vitest";
import {
  call,
  count,
  createOrder,
  denyAll,
  fakeNetwork,
  makeDeps,
  makeEnv,
  orderRow,
  postJson,
  STOREFRONT_ORIGIN,
  validCheckout,
} from "./helpers";

const EXPECTED_TOTAL = 2 * 1945 + 765;

async function checkout(body: unknown, envOverrides = {}, headers: Record<string, string> = {}) {
  const env = makeEnv(envOverrides);
  const net = fakeNetwork();
  const res = await postJson(env, makeDeps(net.fetch), "/api/checkout", body, headers);
  return { env, net, res, body: (await res.clone().json().catch(() => null)) as Record<string, unknown> | null };
}

describe("POST /api/checkout", () => {
  it("stores a pending order and opens a Stripe Checkout session priced by the server", async () => {
    // The client tries to smuggle prices in: they must be ignored.
    const tampered = validCheckout({
      lines: [
        { itemId: "combo-a", quantity: 2, unitPriceCents: 1, priceCents: 1 },
        { itemId: "pollo-con-almendras", quantity: 1, unitPriceCents: 1 },
      ],
      totalCents: 2,
    });
    const { env, net, res, body } = await checkout(tampered);
    expect(res.status).toBe(201);
    expect(body).toMatchObject({ mode: "stripe-test" });
    expect(String(body?.checkoutUrl)).toMatch(/^https:\/\/checkout\.stripe\.com\/c\/pay\/cs_test_fake\d+$/);
    const orderId = String(body?.orderId);
    expect(orderId).toMatch(/^SH-261029-[A-Z0-9]{6}$/);
    expect(String(body?.orderToken)).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const row = orderRow(env, orderId);
    expect(row).toMatchObject({
      status: "pending",
      total_cents: EXPECTED_TOTAL,
      subtotal_cents: EXPECTED_TOTAL,
      delivery_fee_cents: 0,
      storefront: "ink-house",
      fulfillment: "pickup",
      customer_phone: "+34612345678",
      payments_mode: "stripe-test",
    });
    expect(String(body?.checkoutUrl)).toContain(String(row?.stripe_session_id));
    // The token is never stored in clear text.
    expect(row?.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.token_hash).not.toBe(body?.orderToken);
    const items = env.DB.raw
      .prepare("SELECT item_id, quantity, unit_price_cents, line_total_cents FROM order_items WHERE order_id = ? ORDER BY position")
      .all(orderId);
    expect(items.map((i) => ({ ...i }))).toEqual([
      { item_id: "combo-a", quantity: 2, unit_price_cents: 1945, line_total_cents: 3890 },
      { item_id: "pollo-con-almendras", quantity: 1, unit_price_cents: 765, line_total_cents: 765 },
    ]);

    expect(net.stripeCalls).toHaveLength(1);
    const { url, headers, form } = net.stripeCalls[0];
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(headers.get("Authorization")).toBe("Bearer sk_test_51FakeKeyForUnitTestsOnly");
    expect(headers.get("Stripe-Version")).toMatch(/^\d{4}-\d{2}-\d{2}\.[a-z]+$/);
    expect(headers.get("Idempotency-Key")).toBe(`checkout-${orderId}`);
    expect(Object.fromEntries(form)).toMatchObject({
      mode: "payment",
      locale: "es",
      client_reference_id: orderId,
      customer_email: "lucia@example.es",
      "line_items[0][price_data][currency]": "eur",
      "line_items[0][price_data][unit_amount]": "1945",
      "line_items[0][quantity]": "2",
      "line_items[0][price_data][product_data][name]": "Combo A (14 piezas)",
      "line_items[1][price_data][unit_amount]": "765",
      "line_items[1][quantity]": "1",
      "metadata[order_id]": orderId,
      "metadata[storefront]": "ink-house",
      "payment_intent_data[metadata][order_id]": orderId,
    });
    const token = String(body?.orderToken);
    expect(form.get("success_url")).toBe(
      `https://wh14-ua.github.io/mangocat-test/showcase/shang-hai/ink-house/pedido/estado/?pedido=${orderId}&t=${token}`,
    );
    expect(form.get("cancel_url")).toContain("/ink-house/pedido/?cancelado=1");
    const expires = Number(form.get("expires_at"));
    expect(expires - Math.floor(Date.parse("2026-10-29T12:00:00Z") / 1000)).toBe(3600);
    expect(count(env, "SELECT COUNT(*) AS n FROM order_events WHERE order_id = ?", orderId)).toBe(1);
  });

  it.each([
    ["an unknown product", { lines: [{ itemId: "plato-inventado", quantity: 1 }] }, 422, "not-payable"],
    ["a product with a conflicting price", { lines: [{ itemId: "cerveza-china", quantity: 1 }] }, 422, "not-payable"],
    ["a hidden duplicate", { lines: [{ itemId: "frito-gambas-con-atun-2", quantity: 1 }] }, 422, "not-payable"],
    ["a negative quantity", { lines: [{ itemId: "combo-a", quantity: -1 }] }, 422, "invalid"],
    ["a decimal quantity", { lines: [{ itemId: "combo-a", quantity: 1.5 }] }, 422, "invalid"],
    ["a huge quantity", { lines: [{ itemId: "combo-a", quantity: 1_000_000 }] }, 422, "invalid"],
    ["an unknown storefront", { storefront: "competitor-shop" }, 422, "invalid"],
    ["invalid customer data", { customer: { name: "", phone: "abc", email: "no" } }, 422, "invalid"],
    ["alcohol without age confirmation", { lines: [{ itemId: "vino-tinto-de-la-casa", quantity: 1 }], expectedTotalCents: 745 }, 422, "age-confirmation-required"],
    ["own delivery (not enabled)", { fulfillment: "delivery", delivery: { street: "Calle Mayor 1", postalCode: "03300", city: "Orihuela" } }, 422, "not-payable"],
  ])("rejects %s", async (_label, overrides, status, error) => {
    const { res, body, net, env } = await checkout(validCheckout(overrides));
    expect(res.status).toBe(status);
    expect(body?.error).toBe(error);
    expect(net.stripeCalls).toHaveLength(0);
    expect(count(env, "SELECT COUNT(*) AS n FROM orders")).toBe(0);
  });

  it("detects a manipulated total and answers with the real one", async () => {
    const { res, body, net } = await checkout(validCheckout({ expectedTotalCents: 100 }));
    expect(res.status).toBe(409);
    expect(body).toEqual({ error: "price-changed", totalCents: EXPECTED_TOTAL });
    expect(net.stripeCalls).toHaveLength(0);
  });

  it("accepts alcohol once the buyer confirms they are of age", async () => {
    const { res } = await checkout(
      validCheckout({ lines: [{ itemId: "vino-tinto-de-la-casa", quantity: 1 }], expectedTotalCents: 745, ageConfirmed: true }),
    );
    expect(res.status).toBe(201);
  });

  it("prices real options and labels them for Stripe", async () => {
    const { res, net } = await checkout(
      validCheckout({
        lines: [{ itemId: "menu-para-6-personas-a", quantity: 1, selections: { elige: ["con-cafe"] } }],
        expectedTotalCents: 8345,
      }),
    );
    expect(res.status).toBe(201);
    expect(net.stripeCalls[0].form.get("line_items[0][price_data][product_data][description]")).toBe("Con café");
  });

  it("rejects malformed, oversized and non-JSON bodies", async () => {
    expect((await checkout("{not json")).res.status).toBe(400);
    const huge = validCheckout({ customer: { name: "x".repeat(17 * 1024), phone: "612345678", email: "a@b.es" } });
    expect((await checkout(huge)).res.status).toBe(413);
    const env = makeEnv();
    const res = await call(env, makeDeps(fakeNetwork().fetch), "/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "text/plain", Origin: STOREFRONT_ORIGIN },
      body: JSON.stringify(validCheckout()),
    });
    expect(res.status).toBe(415);
  });

  it("refuses to take payments without Stripe keys", async () => {
    const { res, body } = await checkout(validCheckout(), { STRIPE_SECRET_KEY: undefined });
    expect(res.status).toBe(503);
    expect(body).toEqual({ error: "payments-disabled" });
    const env = makeEnv({ STRIPE_WEBHOOK_SECRET: undefined });
    const config = await call(env, makeDeps(fakeNetwork().fetch), "/api/config");
    expect(await config.json()).toEqual({ paymentsMode: "disabled" });
  });

  it("refuses live keys in test mode and needs explicit owner approval for live mode", async () => {
    const live = { STRIPE_SECRET_KEY: "sk_live_51ThisMustNeverWork" };
    const { res } = await checkout(validCheckout(), live);
    expect(res.status).toBe(503);
    const mode = async (overrides: Record<string, string>) => {
      const r = await call(makeEnv(overrides), makeDeps(fakeNetwork().fetch), "/api/config");
      return ((await r.json()) as { paymentsMode: string }).paymentsMode;
    };
    expect(await mode({})).toBe("stripe-test");
    expect(await mode(live)).toBe("disabled");
    expect(await mode({ ...live, STRIPE_TEST_MODE: "false" })).toBe("disabled");
    expect(await mode({ ...live, STRIPE_TEST_MODE: "false", PAYMENTS_LIVE_ENABLED: "true" })).toBe("stripe-live");
    expect(await mode({ STRIPE_TEST_MODE: "false", PAYMENTS_LIVE_ENABLED: "true" })).toBe("disabled");
  });

  it("cancels the order and never returns a URL when Stripe fails", async () => {
    for (const stripe of ["error", "bad-url"] as const) {
      const env = makeEnv();
      const net = fakeNetwork({ stripe });
      const res = await postJson(env, makeDeps(net.fetch), "/api/checkout", validCheckout());
      expect(res.status).toBe(502);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body).toEqual({ error: "server" });
      const row = env.DB.raw.prepare("SELECT status, stripe_session_id FROM orders").get() as Record<string, unknown>;
      expect(row).toMatchObject({ status: "cancelled", stripe_session_id: null });
    }
  });

  it("rate limits checkout attempts", async () => {
    const { res } = await checkout(validCheckout(), { CHECKOUT_LIMITER: denyAll });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("creates distinct orders and tokens for repeated checkouts", async () => {
    const env = makeEnv();
    const a = await createOrder(env);
    const b = await createOrder(env);
    expect(a.orderId).not.toBe(b.orderId);
    expect(a.orderToken).not.toBe(b.orderToken);
  });
});

describe("CORS", () => {
  it("answers preflight only for allowed origins", async () => {
    const env = makeEnv();
    const deps = makeDeps(fakeNetwork().fetch);
    const ok = await call(env, deps, "/api/checkout", {
      method: "OPTIONS",
      headers: { Origin: STOREFRONT_ORIGIN, "Access-Control-Request-Method": "POST" },
    });
    expect(ok.status).toBe(204);
    expect(ok.headers.get("Access-Control-Allow-Origin")).toBe(STOREFRONT_ORIGIN);
    expect(ok.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(ok.headers.get("Vary")).toContain("Origin");

    const foreign = await call(env, deps, "/api/checkout", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "POST" },
    });
    expect(foreign.status).toBe(403);
    expect(foreign.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("refuses checkout requests from foreign origins and tags allowed ones", async () => {
    const blocked = await checkout(validCheckout(), {}, { Origin: "https://evil.example" });
    expect(blocked.res.status).toBe(403);
    expect(blocked.res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    const allowed = await checkout(validCheckout());
    expect(allowed.res.headers.get("Access-Control-Allow-Origin")).toBe(STOREFRONT_ORIGIN);
    expect(allowed.res.headers.get("Vary")).toContain("Origin");
  });

  it("never adds CORS headers to the webhook or the staff API", async () => {
    const env = makeEnv();
    const deps = makeDeps(fakeNetwork().fetch);
    for (const path of ["/api/stripe/webhook", "/api/admin/orders"]) {
      const res = await call(env, deps, path, { method: "POST", headers: { Origin: STOREFRONT_ORIGIN } });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    }
  });

  it("sends security headers", async () => {
    const res = await call(makeEnv(), makeDeps(fakeNetwork().fetch), "/api/health");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Content-Security-Policy")).toContain("default-src 'none'");
  });
});
