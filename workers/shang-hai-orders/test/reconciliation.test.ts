import { describe, expect, it } from "vitest";
import {
  CHECKOUT_TOTAL,
  count,
  createOrder,
  customerView,
  deliver,
  orderRow,
  pay,
  placedOrder,
  runCron,
  staffAction,
  staffCookie,
  world,
} from "./helpers";

/**
 * The order always converges on what Stripe really did (QA audit PAY-F6/F7/F8/F10/F11/F12):
 * nothing is cancelled while money is on its way, nothing reaches the kitchen as paid when it
 * was refunded, nothing gets stuck because something else failed, nothing Stripe sends is lost.
 */

describe("payments still on their way", () => {
  it("a payment still processing at 75 minutes is not cancelled; when it succeeds it reaches the restaurant", async () => {
    const w = world({ STRIPE_CAPTURE_MODE: "per-method" });
    const order = await createOrder(w);
    const [completed] = w.stripe.completeSession(order.sessionId, "capture");
    w.stripe.takeEvents();
    const pi = w.stripe.intent(w.stripe.session(order.sessionId).payment_intent);
    pi.status = "processing"; // a delayed-notification method: Stripe has not settled it yet
    pi.amount_received = 0;
    await deliver(w, [completed]);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "pending", payment_status: "processing" });

    w.advance(76 * 60_000);
    await runCron(w);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "pending", payment_status: "processing" });
    expect((await customerView(w, order)).status).toBe("pending"); // never "cancelled, nothing charged"

    pi.status = "succeeded";
    pi.amount_received = pi.amount;
    await deliver(w, [w.stripe.event("payment_intent.succeeded", pi)]);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "awaiting_acceptance", payment_status: "captured" });
  });

  it("an abandoned checkout (no payment at all) is still closed after the session expires", async () => {
    const w = world();
    const order = await createOrder(w);
    w.advance(76 * 60_000);
    await runCron(w);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "cancelled", payment_status: "unpaid" });
  });
});

describe("ACEPTAR on a payment that was charged at once", () => {
  it("reads Stripe first: a refund made from the Dashboard (webhook not processed yet) never reaches the kitchen", async () => {
    const w = world({ STRIPE_CAPTURE_MODE: "per-method" });
    const order = await placedOrder(w, {}, "capture");
    const piId = orderRow(w.env, order.orderId)?.stripe_payment_intent_id as string;
    expect(w.stripe.handle("POST", "/v1/refunds", new URLSearchParams([["payment_intent", piId]]), {}).status).toBe(200);
    w.stripe.takeEvents(); // its webhooks are still on their way

    const res = await staffAction(w, await staffCookie(w.env, "Móvil", w.now()), order.orderId, "accept", { prepMinutes: 20 });
    expect(res.status).toBe(502);
    expect(String(res.body.message)).toMatch(/NO prepares este pedido/);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "needs_review", payment_status: "refunded" });
    expect((await customerView(w, order)).status).not.toBe("preparing");
  });

  it("with the money still there, it is accepted (and nothing is charged again)", async () => {
    const w = world({ STRIPE_CAPTURE_MODE: "per-method" });
    const order = await placedOrder(w, {}, "capture");
    const res = await staffAction(w, await staffCookie(w.env, "Móvil", w.now()), order.orderId, "accept", { prepMinutes: 20 });
    expect(res.status).toBe(200);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "preparing", payment_status: "captured" });
    expect(w.net.stripeCalls.filter((c) => c.url.endsWith("/capture"))).toHaveLength(0);
  });
});

describe("the cron's queues never starve", () => {
  it("twenty refunds that cannot be read do not block a twenty-first that completed", async () => {
    const w = world({ STRIPE_CAPTURE_MODE: "per-method" });
    const cookie = await staffCookie(w.env, "Móvil", w.now());
    w.stripe.setRefundOutcome("pending");
    const stuck: string[] = [];
    for (let i = 0; i < 20; i++) {
      const o = await placedOrder(w, {}, "capture");
      await staffAction(w, cookie, o.orderId, "reject", {});
      stuck.push(o.orderId);
    }
    // Stripe cannot be read for those twenty (persistent 500 on their payments).
    const stuckIntents = stuck.map((id) => orderRow(w.env, id)?.stripe_payment_intent_id as string);
    w.stripe.failNext({ method: "GET", path: new RegExp(`/v1/payment_intents/(${stuckIntents.join("|")})`), status: 500, times: 10_000 });

    w.advance(1_000);
    const live = await placedOrder(w, {}, "capture");
    await staffAction(w, cookie, live.orderId, "reject", {});
    const refundId = orderRow(w.env, live.orderId)?.stripe_refund_id as string;
    w.stripe.settleRefund(refundId, "succeeded");
    w.stripe.takeEvents(); // its webhook is lost: the cron is the only way to learn it

    for (let i = 0; i < 4; i++) {
      w.advance(6 * 60_000);
      await runCron(w);
    }
    expect(orderRow(w.env, live.orderId)?.payment_status).toBe("refunded");
  });
});

describe("a checkout that could not record its payment session", () => {
  it("does not send the customer to pay, and the order is closed (nothing can have been paid)", async () => {
    const w = world();
    const realPrepare = w.env.DB.prepare.bind(w.env.DB);
    let armed = true;
    w.env.DB.prepare = ((sql: string) => {
      const stmt = realPrepare(sql);
      if (armed && sql.startsWith("UPDATE orders SET stripe_session_id")) {
        armed = false;
        const failing = {
          bind: () => failing,
          run: async () => {
            throw new Error("D1_ERROR: storage operation exceeded timeout");
          },
          first: stmt.first.bind(stmt),
          all: stmt.all.bind(stmt),
        };
        return failing;
      }
      return stmt;
    }) as typeof w.env.DB.prepare;

    await expect(createOrder(w)).rejects.toThrow(/checkout failed: 503/);
    const id = (w.env.DB.raw.prepare("SELECT id FROM orders ORDER BY created_at DESC LIMIT 1").get() as { id: string }).id;
    expect(orderRow(w.env, id)?.stripe_session_id).toBeNull();
    w.advance(76 * 60_000);
    await runCron(w);
    expect(orderRow(w.env, id)).toMatchObject({ status: "cancelled", payment_status: "unpaid" });
  });
});

describe("a reviewed amount mismatch", () => {
  it("once staff accept it, the capture's own webhook does not bounce it back to review", async () => {
    const w = world();
    const order = await createOrder(w);
    w.stripe.session(order.sessionId).amount_total = CHECKOUT_TOTAL - 100;
    await pay(w, order.sessionId);
    expect(orderRow(w.env, order.orderId)?.status).toBe("needs_review");
    const cookie = await staffCookie(w.env, "Móvil", w.now());
    expect((await staffAction(w, cookie, order.orderId, "accept", { prepMinutes: 20 })).status).toBe(200);
    await deliver(w, w.stripe.takeEvents());
    expect(orderRow(w.env, order.orderId)?.status).toBe("preparing");
    expect((await staffAction(w, cookie, order.orderId, "ready")).status).toBe(200);
  });
});

describe("events Stripe sends while payments are switched off", () => {
  it("are answered with an error so Stripe delivers them again, and are applied once payments are back", async () => {
    const w = world();
    const order = await placedOrder(w);
    await staffAction(w, await staffCookie(w.env, "Móvil", w.now()), order.orderId, "accept", { prepMinutes: 20 });
    await deliver(w, w.stripe.takeEvents());
    const piId = orderRow(w.env, order.orderId)?.stripe_payment_intent_id as string;
    w.stripe.handle("POST", "/v1/refunds", new URLSearchParams([["payment_intent", piId]]), {}); // refunded in the Dashboard
    const events = w.stripe.takeEvents();

    const key = w.env.STRIPE_SECRET_KEY;
    w.env.STRIPE_SECRET_KEY = ""; // a key rotation / misconfiguration window
    const first = await deliver(w, events);
    expect(first.every((r) => r.status >= 500)).toBe(true);
    expect(count(w.env, "SELECT COUNT(*) AS n FROM stripe_events WHERE status = 'ignored'")).toBe(0);

    w.env.STRIPE_SECRET_KEY = key;
    const again = await deliver(w, events); // Stripe's retry
    expect(again.every((r) => r.status === 200)).toBe(true);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "needs_review", payment_status: "refunded" });
  });
});
