import { describe, expect, it } from "vitest";
import {
  count,
  createOrder,
  deliver,
  orderRow,
  pay,
  placedOrder,
  runCron,
  staffAction,
  staffCookie,
  world,
  type World,
} from "./helpers";

/**
 * Incidents that need a person are never silent (QA audit PAY-F3/F4/F5/F9): every entry into
 * EN REVISIÓN is alerted, an alert lost to a failure is recreated by the cron, unattended
 * incidents are reminded, and alerts say what really happened to the money.
 */

const plain = (text: string) => text.replace(/<[^>]+>/g, "");
const reviewAlerts = (w: World) => w.telegram.messages().filter((m) => plain(m.text).includes("necesita revisión"));

/** The next D1 batch that writes to `notifications` fails (a transient D1 error, or the isolate stopped). */
function failNextNotificationWrite(w: World) {
  const real = w.env.DB.batch.bind(w.env.DB);
  let armed = true;
  w.env.DB.batch = (async (statements: { sql?: string }[]) => {
    if (armed && statements.some((s) => String(s.sql ?? "").includes("INTO notifications"))) {
      armed = false;
      throw new Error("D1_ERROR: Network connection lost.");
    }
    return real(statements as never);
  }) as typeof w.env.DB.batch;
}

describe("EN REVISIÓN is always alerted", () => {
  it("an order that enters review a second time (a refund that fails again days later) alerts again", async () => {
    const w = world({ STRIPE_CAPTURE_MODE: "per-method" });
    const order = await placedOrder(w, {}, "capture"); // charged at once
    const cookie = await staffCookie(w.env, "Móvil de cocina", w.now());

    w.stripe.setRefundOutcome("failed");
    await staffAction(w, cookie, order.orderId, "reject", { reason: "Cerrado" });
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "needs_review", payment_status: "refund_failed" });
    expect(reviewAlerts(w)).toHaveLength(2); // two authorised chats

    w.stripe.setRefundOutcome("pending");
    await staffAction(w, cookie, order.orderId, "reject", { reason: "Cerrado" });
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "rejected", payment_status: "refund_pending" });

    w.advance(2 * 86_400_000);
    const refundId = orderRow(w.env, order.orderId)?.stripe_refund_id as string;
    await deliver(w, w.stripe.settleRefund(refundId, "failed"));
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "needs_review", payment_status: "refund_failed" });
    expect(reviewAlerts(w)).toHaveLength(4); // a new incident, a new alert to each chat
    expect(plain(reviewAlerts(w)[3].text)).toMatch(/La devolución ha fallado/);
  });

  it("an unattended incident is reminded every hour, and only while it is unattended", async () => {
    const w = world({ STRIPE_CAPTURE_MODE: "per-method", ACCEPTANCE_REMINDER_MINUTES: "0" });
    const order = await placedOrder(w, {}, "capture");
    const cookie = await staffCookie(w.env, "Móvil de cocina", w.now());
    w.stripe.setRefundOutcome("failed");
    await staffAction(w, cookie, order.orderId, "reject", {});
    expect(reviewAlerts(w)).toHaveLength(2);
    for (let i = 0; i < 5; i++) {
      w.advance(10 * 60_000);
      await runCron(w);
    }
    expect(reviewAlerts(w)).toHaveLength(2); // 50 minutes: no spam
    w.advance(15 * 60_000);
    await runCron(w);
    expect(reviewAlerts(w)).toHaveLength(4); // over an hour unattended: reminded
    // A person resolves it: no more reminders.
    w.stripe.setRefundOutcome("succeeded");
    expect((await staffAction(w, cookie, order.orderId, "reject", {})).status).toBe(200);
    w.advance(2 * 60 * 60_000);
    await runCron(w);
    expect(reviewAlerts(w)).toHaveLength(4);
  });
});

describe("an alert lost to a failure is recreated", () => {
  it("new order: the enqueue failed after the payment was recorded → the cron sends the alert (and the timeout can start)", async () => {
    const w = world({ ACCEPTANCE_REMINDER_MINUTES: "0" });
    const order = await createOrder(w);
    failNextNotificationWrite(w);
    const responses = await pay(w, order.sessionId);
    expect(responses.map((r) => r.status)).toEqual([200, 200]); // Stripe will not resend
    expect(count(w.env, "SELECT COUNT(*) AS n FROM notifications WHERE order_id = ?", order.orderId)).toBe(0);

    w.advance(60_000);
    const report = await runCron(w);
    expect(report.alerts).toBe(2);
    expect(w.telegram.messages().filter((m) => plain(m.text).includes("NUEVO PEDIDO"))).toHaveLength(2);
    // Running again creates nothing more.
    w.advance(60_000);
    expect((await runCron(w)).alerts).toBe(0);
  });

  it("review: the alert write failed → the cron alerts the incident", async () => {
    const w = world({ STRIPE_CAPTURE_MODE: "per-method" });
    const order = await placedOrder(w, {}, "capture");
    w.stripe.setRefundOutcome("failed");
    failNextNotificationWrite(w);
    const res = await staffAction(w, await staffCookie(w.env, "Móvil", w.now()), order.orderId, "reject", {});
    expect(res.body.order).toMatchObject({ status: "needs_review", paymentStatus: "refund_failed" });
    expect(reviewAlerts(w)).toHaveLength(0);
    w.advance(60_000);
    await runCron(w);
    expect(reviewAlerts(w)).toHaveLength(2);
  });
});

describe("who gets alerts, and what they say", () => {
  it("a chat removed from TELEGRAM_CHAT_IDS gets no queued retries", async () => {
    const w = world();
    w.telegram.failNext({ status: 500 });
    w.telegram.failNext({ status: 500 });
    const order = await placedOrder(w); // both chats failed: retries queued
    w.env.TELEGRAM_CHAT_IDS = "111111111"; // the second phone is removed
    w.advance(5 * 60_000);
    await runCron(w);
    const delivered = w.telegram.messages().filter((m) => m.text.includes("NUEVO PEDIDO")).map((m) => m.chat_id);
    expect(delivered).toEqual(["111111111"]);
    expect(count(w.env, "SELECT COUNT(*) AS n FROM notifications WHERE order_id = ? AND status = 'skipped'", order.orderId)).toBe(1);
  });

  it("the automatic decline alert says what happened to the money", async () => {
    const authorised = world({ ACCEPTANCE_TIMEOUT_MINUTES: "30" });
    await placedOrder(authorised);
    authorised.advance(31 * 60_000);
    await runCron(authorised);
    expect(plain(authorised.telegram.lastText() ?? "")).toMatch(/no se ha cobrado nada/);

    const charged = world({ ACCEPTANCE_TIMEOUT_MINUTES: "30", STRIPE_CAPTURE_MODE: "per-method" });
    await placedOrder(charged, {}, "capture");
    charged.stripe.setRefundOutcome("pending");
    charged.advance(31 * 60_000);
    await runCron(charged);
    const text = plain(charged.telegram.lastText() ?? "");
    expect(text).toMatch(/cancelado automáticamente/);
    expect(text).toMatch(/devolución del importe cobrado; Stripe aún no la ha confirmado/);
    expect(text).not.toMatch(/no se ha cobrado nada/);
  });

  it("when Stripe cannot confirm the automatic decline, no 'cancelled' alert claims it was done", async () => {
    const w = world({ ACCEPTANCE_TIMEOUT_MINUTES: "30" });
    await placedOrder(w);
    w.stripe.failNext({ method: "GET", path: /^\/v1\/payment_intents\//, network: true, times: 50 });
    w.advance(31 * 60_000);
    const report = await runCron(w);
    expect(report.timeouts).toBe(0);
    expect(w.telegram.messages().some((m) => plain(m.text).includes("cancelado automáticamente"))).toBe(false);
  });
});
