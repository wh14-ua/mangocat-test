import { describe, expect, it } from "vitest";
import { verifyStripeSignature } from "../src/stripe";
import { hmacSha256Hex } from "../src/crypto";
import { count, createOrder, deliver, makeEnv, NOW, orderRow, pay, sessionEvent, signedWebhook, WEBHOOK_SECRET, world } from "./helpers";

describe("Stripe signature verification", () => {
  const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
  const t = Math.floor(NOW.getTime() / 1000);

  it("accepts a valid v1 signature and any of several (secret rotation)", async () => {
    const good = await hmacSha256Hex(WEBHOOK_SECRET, `${t}.${body}`);
    expect(await verifyStripeSignature(body, `t=${t},v1=${good}`, WEBHOOK_SECRET, t)).toEqual({ ok: true, timestamp: t });
    expect((await verifyStripeSignature(body, `t=${t},v1=${"0".repeat(64)},v1=${good}`, WEBHOOK_SECRET, t)).ok).toBe(true);
  });

  it("rejects tampered bodies, old timestamps and malformed headers", async () => {
    const good = await hmacSha256Hex(WEBHOOK_SECRET, `${t}.${body}`);
    expect(await verifyStripeSignature(`${body} `, `t=${t},v1=${good}`, WEBHOOK_SECRET, t)).toMatchObject({ reason: "no-matching-signature" });
    expect(await verifyStripeSignature(body, `t=${t},v1=${good}`, WEBHOOK_SECRET, t + 301)).toMatchObject({ reason: "timestamp-out-of-tolerance" });
    expect(await verifyStripeSignature(body, `v1=${good}`, WEBHOOK_SECRET, t)).toMatchObject({ reason: "malformed-header" });
    expect(await verifyStripeSignature(body, null, WEBHOOK_SECRET, t)).toMatchObject({ reason: "missing-header" });
    expect(await verifyStripeSignature(body, `t=${t},v0=${good}`, WEBHOOK_SECRET, t)).toMatchObject({ reason: "malformed-header" });
  });

  it("the endpoint refuses unsigned or wrongly signed events and changes nothing", async () => {
    const env = makeEnv();
    const order = await createOrder(env);
    const event = sessionEvent("checkout.session.completed", { id: order.sessionId, client_reference_id: order.orderId });
    expect((await signedWebhook(env, event, { secret: "whsec_wrong" })).status).toBe(400);
    expect(orderRow(env, order.orderId)?.status).toBe("pending");
    expect((await signedWebhook(makeEnv({ STRIPE_WEBHOOK_SECRET: "" }), event)).status).toBe(503);
  });
});

describe("Stripe events", () => {
  it("processes each event id once", async () => {
    const w = world();
    const order = await createOrder(w);
    const events = w.stripe.completeSession(order.sessionId, "authorize");
    w.stripe.takeEvents();
    await deliver(w, events);
    const again = await deliver(w, events);
    expect(await again[0].json()).toMatchObject({ duplicate: true });
    expect(count(w.env, "SELECT COUNT(*) AS n FROM order_events WHERE order_id = ? AND to_status = 'awaiting_acceptance'", order.orderId)).toBe(1);
    expect(w.telegram.messages()).toHaveLength(2); // still one alert per chat
  });

  it("converges whatever the arrival order", async () => {
    const w = world();
    const order = await createOrder(w);
    const events = w.stripe.completeSession(order.sessionId, "authorize");
    w.stripe.takeEvents();
    await deliver(w, [...events].reverse());
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "awaiting_acceptance", payment_status: "authorized" });
  });

  it("asks Stripe to retry (500) when Stripe itself cannot be read, and succeeds on the retry", async () => {
    const w = world();
    const order = await createOrder(w);
    const events = w.stripe.completeSession(order.sessionId, "authorize");
    w.stripe.takeEvents();
    w.stripe.failNext({ method: "GET", path: /^\/v1\/payment_intents\//, status: 500 });
    const [first] = await deliver(w, [events[0]]);
    expect(first.status).toBe(500);
    expect(orderRow(w.env, order.orderId)?.status).toBe("pending");
    const [retry] = await deliver(w, [events[0]]); // Stripe retries the same event id
    expect(retry.status).toBe(200);
    expect(orderRow(w.env, order.orderId)?.status).toBe("awaiting_acceptance");
  });

  it("ignores events of the other mode (live vs test) and of unknown orders", async () => {
    const w = world();
    const order = await createOrder(w);
    await pay(w, order.sessionId);
    const live = sessionEvent("checkout.session.expired", { id: order.sessionId, client_reference_id: order.orderId }, { livemode: true });
    expect((await deliver(w, [live]))[0].status).toBe(200);
    expect(orderRow(w.env, order.orderId)?.status).toBe("awaiting_acceptance");
    const unknown = sessionEvent("checkout.session.completed", { id: "cs_test_other", client_reference_id: "SH-261029-ZZZZZZ" });
    expect(await (await deliver(w, [unknown]))[0].json()).toMatchObject({ received: true });
  });

  it("flags a session that is not the one created for the order", async () => {
    const w = world();
    const order = await createOrder(w);
    const forged = sessionEvent("checkout.session.completed", { id: "cs_test_forged", client_reference_id: order.orderId, payment_intent: "pi_x" });
    await deliver(w, [forged]);
    expect(orderRow(w.env, order.orderId)?.status).toBe("needs_review");
  });

  it("records when the last webhook arrived (panel health)", async () => {
    const w = world();
    const order = await createOrder(w);
    await pay(w, order.sessionId);
    expect(count(w.env, "SELECT COUNT(*) AS n FROM system_state WHERE key = 'stripe.last_webhook'")).toBe(1);
  });
});

describe("payloads that are valid JSON but not events (found by fuzzing)", () => {
  it("a signed null, number, string or array is a 400, never a 500", async () => {
    const env = makeEnv();
    for (const payload of [null, 0, "x", [], [{}], true]) {
      expect((await signedWebhook(env, payload)).status, JSON.stringify(payload)).toBe(400);
    }
  });
});
