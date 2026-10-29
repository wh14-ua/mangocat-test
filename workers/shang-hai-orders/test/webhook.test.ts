import { describe, expect, it } from "vitest";
import {
  call,
  count,
  createOrder,
  fakeNetwork,
  makeDeps,
  makeEnv,
  NOW,
  orderRow,
  sessionEvent,
  signedWebhook,
  WEBHOOK_SECRET,
} from "./helpers";
import { hmacSha256Hex } from "../src/crypto";
import { verifyStripeSignature } from "../src/stripe";

const TOTAL = 2 * 1945 + 765;

async function paidOrder() {
  const env = makeEnv();
  const order = await createOrder(env);
  const session = {
    id: order.sessionId,
    client_reference_id: order.orderId,
    metadata: { order_id: order.orderId },
    amount_total: TOTAL,
    payment_status: "paid",
    payment_intent: "pi_test_123",
  };
  return { env, order, session };
}

describe("Stripe webhook", () => {
  it("rejects missing, forged and stale signatures", async () => {
    const { env, session } = await paidOrder();
    const event = sessionEvent("checkout.session.completed", session);
    const unsigned = await call(env, makeDeps(fakeNetwork().fetch), "/api/stripe/webhook", {
      method: "POST",
      body: JSON.stringify(event),
    });
    expect(unsigned.status).toBe(400);
    expect((await signedWebhook(env, event, { secret: "whsec_wrong" })).status).toBe(400);
    const stale = Math.floor(NOW.getTime() / 1000) - 10 * 60;
    expect((await signedWebhook(env, event, { timestamp: stale })).status).toBe(400);
    expect(count(env, "SELECT COUNT(*) AS n FROM stripe_events")).toBe(0);
  });

  it("accepts any of several v1 signatures (secret rotation) and ignores v0", async () => {
    const body = '{"id":"evt_x"}';
    const t = Math.floor(NOW.getTime() / 1000);
    const good = await hmacSha256Hex(WEBHOOK_SECRET, `${t}.${body}`);
    const header = `t=${t},v0=${"0".repeat(64)},v1=${"a".repeat(64)},v1=${good}`;
    expect(await verifyStripeSignature(body, header, WEBHOOK_SECRET, t)).toEqual({ ok: true, timestamp: t });
    expect(await verifyStripeSignature(body, `t=${t},v0=${good}`, WEBHOOK_SECRET, t)).toMatchObject({ ok: false });
    expect(await verifyStripeSignature(body + " ", `t=${t},v1=${good}`, WEBHOOK_SECRET, t)).toMatchObject({ ok: false });
  });

  it("marks the order paid on checkout.session.completed with payment_status=paid", async () => {
    const { env, order, session } = await paidOrder();
    const res = await signedWebhook(env, sessionEvent("checkout.session.completed", session, { id: "evt_paid" }));
    expect(res.status).toBe(200);
    expect(orderRow(env, order.orderId)).toMatchObject({
      status: "paid",
      stripe_payment_intent_id: "pi_test_123",
      stripe_payment_status: "paid",
      stripe_amount_total: TOTAL,
      paid_at: NOW.toISOString(),
    });
    expect(env.DB.raw.prepare("SELECT status, order_id FROM stripe_events WHERE id = 'evt_paid'").get()).toMatchObject({
      status: "processed",
      order_id: order.orderId,
    });
  });

  it("processes the same event only once", async () => {
    const { env, order, session } = await paidOrder();
    const event = sessionEvent("checkout.session.completed", session, { id: "evt_dup" });
    await signedWebhook(env, event);
    const eventsAfterFirst = count(env, "SELECT COUNT(*) AS n FROM order_events WHERE order_id = ?", order.orderId);
    const second = await signedWebhook(env, event);
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ duplicate: true });
    expect(count(env, "SELECT COUNT(*) AS n FROM order_events WHERE order_id = ?", order.orderId)).toBe(eventsAfterFirst);
    expect(count(env, "SELECT COUNT(*) AS n FROM stripe_events")).toBe(1);
  });

  it("sends the order to review when the charged amount does not match", async () => {
    const { env, order, session } = await paidOrder();
    await signedWebhook(env, sessionEvent("checkout.session.completed", { ...session, amount_total: TOTAL - 1 }));
    expect(orderRow(env, order.orderId)?.status).toBe("needs_review");
  });

  it("sends the order to review when test/live mode does not match", async () => {
    const { env, order, session } = await paidOrder();
    await signedWebhook(env, sessionEvent("checkout.session.completed", session, { livemode: true }));
    expect(orderRow(env, order.orderId)?.status).toBe("needs_review");
  });

  it("rejects a session that belongs to another order", async () => {
    const { env, order, session } = await paidOrder();
    await signedWebhook(env, sessionEvent("checkout.session.completed", { ...session, id: "cs_test_other" }));
    expect(orderRow(env, order.orderId)?.status).toBe("needs_review");
  });

  it("waits for asynchronous payments, then follows their outcome", async () => {
    const { env, order, session } = await paidOrder();
    await signedWebhook(env, sessionEvent("checkout.session.completed", { ...session, payment_status: "unpaid" }));
    expect(orderRow(env, order.orderId)?.status).toBe("pending");
    await signedWebhook(env, sessionEvent("checkout.session.async_payment_succeeded", session));
    expect(orderRow(env, order.orderId)?.status).toBe("paid");

    const failed = await paidOrder();
    await signedWebhook(failed.env, sessionEvent("checkout.session.completed", { ...failed.session, payment_status: "unpaid" }));
    await signedWebhook(failed.env, sessionEvent("checkout.session.async_payment_failed", failed.session));
    expect(orderRow(failed.env, failed.order.orderId)?.status).toBe("failed");
  });

  it("cancels pending orders whose session expired, but never paid ones", async () => {
    const { env, order, session } = await paidOrder();
    await signedWebhook(env, sessionEvent("checkout.session.expired", { ...session, payment_status: "unpaid" }));
    expect(orderRow(env, order.orderId)?.status).toBe("cancelled");

    const paid = await paidOrder();
    await signedWebhook(paid.env, sessionEvent("checkout.session.completed", paid.session));
    await signedWebhook(paid.env, sessionEvent("checkout.session.expired", paid.session));
    expect(orderRow(paid.env, paid.order.orderId)?.status).toBe("paid");
  });

  it("acknowledges unrelated events and unknown orders without changing anything", async () => {
    const { env, order, session } = await paidOrder();
    const other = await signedWebhook(env, { id: "evt_other", type: "customer.created", data: { object: {} } });
    expect(other.status).toBe(200);
    const unknown = await signedWebhook(
      env,
      sessionEvent("checkout.session.completed", { ...session, client_reference_id: "SH-261029-AAAAAA", metadata: {} }),
    );
    expect(unknown.status).toBe(200);
    expect(orderRow(env, order.orderId)?.status).toBe("pending");
  });

  it("never marks an order paid just because the customer reaches the success URL", async () => {
    const env = makeEnv();
    const order = await createOrder(env);
    const success = order.stripeCalls[0].form.get("success_url") ?? "";
    // The storefront's status page only reads the order through the API:
    const res = await call(env, makeDeps(fakeNetwork().fetch), `/api/orders/${order.orderId}`, {
      headers: { Authorization: `Bearer ${new URL(success).searchParams.get("t")}` },
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { order: { status: string } }).order.status).toBe("pending");
    expect(orderRow(env, order.orderId)?.status).toBe("pending");
  });

  it("is closed when no webhook secret is configured", async () => {
    const env = makeEnv({ STRIPE_WEBHOOK_SECRET: undefined });
    const res = await call(env, makeDeps(fakeNetwork().fetch), "/api/stripe/webhook", { method: "POST", body: "{}" });
    expect(res.status).toBe(503);
  });
});
