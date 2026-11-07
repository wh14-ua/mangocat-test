import { describe, expect, it } from "vitest";
import { acceptanceDeadlineMinutes } from "../src/config";
import type { Env } from "../src/env";
import {
  CHECKOUT_TOTAL,
  count,
  createOrder,
  customerView,
  gateStripe,
  orderRow,
  pay,
  placedOrder,
  runCron,
  staffAction,
  staffCookie,
  WHATSAPP_ENV,
  world,
  type World,
} from "./helpers";

/**
 * The hard limit on how long a customer's money can stay held for an order nobody decided
 * (QA finding WA-4). The usual automatic decline counts ACCEPTANCE_TIMEOUT_MINUTES from the
 * moment the restaurant was told — a WhatsApp alert the phone confirmed —, so if Meta fails for
 * good (expired token, template never approved, number not allowed, webhook never subscribed)
 * and nobody opens the panel, that clock never starts. The hard limit counts from the payment,
 * whatever the alerts did, and Stripe is read before anything is done to the money.
 */

const TIMEOUT_REASON = "El restaurante no ha podido confirmar el pedido a tiempo";
const MINUTE = 60_000;

/** WhatsApp as the only channel, failing for good from the start: nobody is ever told. */
function silentRestaurant(extra: Partial<Env> = {}) {
  const w = world({ ...WHATSAPP_ENV, ACCEPTANCE_TIMEOUT_MINUTES: "30", ...extra });
  w.whatsapp.expireToken();
  return w;
}

const pi = (w: World, id: string) => String(orderRow(w.env, id)?.stripe_payment_intent_id);

/** Stripe calls made since index `from` of the call log, as "METHOD /path". */
const callsSince = (w: World, from: number) => w.net.stripeCalls.slice(from).map((c) => `${c.method} ${new URL(c.url).pathname}`);

const refundsOf = (w: World, id: string) => [...w.stripe.state.refunds.values()].filter((r) => r.payment_intent === pi(w, id));

/** An order whose payment does not match it (amount): EN REVISIÓN from the start, money held. */
async function reviewedOrder(w: World, outcome: "authorize" | "capture" = "authorize") {
  const order = await createOrder(w);
  w.stripe.session(order.sessionId).amount_total = CHECKOUT_TOTAL - 100;
  await pay(w, order.sessionId, outcome);
  return order;
}

describe("hard limit: an order nobody decided never keeps the customer's money held", () => {
  it("WhatsApp failing for good: nothing happens before 60 min after payment; then Stripe is read, the hold released, the customer told", async () => {
    const w = silentRestaurant();
    const order = await placedOrder(w);
    expect(count(w.env, "SELECT COUNT(*) AS n FROM notifications WHERE kind = 'new_order' AND status = 'sent'")).toBe(0);

    w.advance(59 * MINUTE);
    let mark = w.net.stripeCalls.length;
    await runCron(w);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "awaiting_acceptance", payment_status: "authorized" });
    expect(callsSince(w, mark)).toEqual([]); // nothing is due: Stripe is not even asked

    w.advance(2 * MINUTE);
    mark = w.net.stripeCalls.length;
    const report = await runCron(w);
    expect(report.deadlines).toBe(1);
    const calls = callsSince(w, mark);
    const cancel = calls.indexOf(`POST /v1/payment_intents/${pi(w, order.orderId)}/cancel`);
    expect(cancel).toBeGreaterThan(0);
    expect(calls.slice(0, cancel)).toContain(`GET /v1/payment_intents/${pi(w, order.orderId)}`);
    expect(w.stripe.intent(pi(w, order.orderId)).status).toBe("canceled");
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "rejected", payment_status: "canceled", lock_token: null });
    expect(await customerView(w, order)).toMatchObject({ status: "rejected", paymentStatus: "canceled", rejectionReason: TIMEOUT_REASON });
    expect(count(w.env, "SELECT COUNT(*) AS n FROM notifications WHERE order_id = ? AND kind = 'auto_cancelled'", order.orderId)).toBe(1);
  });

  const PERMANENT_META_FAILURES: [string, (w: World) => void][] = [
    ["expired access token (190)", (w) => w.whatsapp.expireToken()],
    ["template never approved (132001)", (w) => w.whatsapp.setTemplateStatus("pedido_nuevo", "PENDING")],
    ["the owner's number not on the test number's list (131030)", (w) => void (w.whatsapp.state.allowedRecipients = ["34600999999"])],
    ["webhook never subscribed: accepted by the API, never confirmed", () => undefined],
  ];
  for (const [failure, breakMeta] of PERMANENT_META_FAILURES) {
    it(`${failure}: still resolved at the hard limit`, async () => {
      const w = world({ ...WHATSAPP_ENV, ACCEPTANCE_TIMEOUT_MINUTES: "30" });
      breakMeta(w);
      const order = await placedOrder(w);
      w.advance(61 * MINUTE);
      await runCron(w);
      expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "rejected", payment_status: "canceled" });
      expect(w.stripe.intent(pi(w, order.orderId)).status).toBe("canceled");
    });
  }

  it("Stripe unreachable at the limit: the order is left exactly as it was (still acceptable); declined on the next run once Stripe answers", async () => {
    const w = silentRestaurant();
    const order = await placedOrder(w);
    w.advance(61 * MINUTE);
    w.stripe.failNext({ method: "GET", path: /^\/v1\/payment_intents\//, network: true, times: 50 });
    const mark = w.net.stripeCalls.length;
    expect((await runCron(w)).deadlines).toBe(0);
    expect(callsSince(w, mark).filter((c) => c.startsWith("POST"))).toEqual([]);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "awaiting_acceptance", payment_status: "authorized", lock_token: null });

    w.stripe.clearFailures();
    w.advance(MINUTE);
    expect((await runCron(w)).deadlines).toBe(1);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "rejected", payment_status: "canceled" });
  });

  it("a hold Stripe already dropped (authorisation expired, webhook lost): only read, never cancelled again; closed, nothing charged", async () => {
    const w = silentRestaurant();
    const order = await placedOrder(w);
    w.stripe.expireAuthorization(pi(w, order.orderId));
    w.stripe.takeEvents(); // its webhooks never arrive: D1 still says "authorized"
    w.advance(61 * MINUTE);
    const mark = w.net.stripeCalls.length;
    await runCron(w);
    expect(callsSince(w, mark).filter((c) => c.startsWith("POST"))).toEqual([]);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "rejected", payment_status: "canceled" });
    expect(await customerView(w, order)).toMatchObject({ status: "rejected", paymentStatus: "canceled" });
  });

  it("charged at once (per-method) and nobody told: refunded at the limit — the payment and its refunds are read before the refund", async () => {
    const w = silentRestaurant({ STRIPE_CAPTURE_MODE: "per-method" });
    const order = await placedOrder(w, {}, "capture");
    w.advance(61 * MINUTE);
    const mark = w.net.stripeCalls.length;
    await runCron(w);
    const calls = callsSince(w, mark);
    const refund = calls.indexOf("POST /v1/refunds");
    expect(refund).toBeGreaterThan(0);
    expect(calls.slice(0, refund)).toEqual(expect.arrayContaining([`GET /v1/payment_intents/${pi(w, order.orderId)}`, "GET /v1/refunds"]));
    expect(refundsOf(w, order.orderId)).toHaveLength(1);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "rejected", payment_status: "refunded" });
  });

  it("a staff decision in the last 10 minutes holds it back (the person retrying is not overruled); then it applies", async () => {
    const w = silentRestaurant();
    const order = await placedOrder(w);
    const cookie = await staffCookie(w.env, "Móvil A", w.now());
    w.advance(55 * MINUTE);
    w.stripe.failNext({ method: "POST", path: /\/capture$/, status: 500 });
    expect((await staffAction(w, cookie, order.orderId, "accept", { prepMinutes: 15 })).status).toBe(502);
    w.advance(6 * MINUTE); // 61 min after payment, 6 after the attempt
    await runCron(w);
    expect(orderRow(w.env, order.orderId)?.status).toBe("awaiting_acceptance");
    w.advance(5 * MINUTE); // 11 min after the attempt
    await runCron(w);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "rejected", payment_status: "canceled" });
  });

  it("switching off the decline counted from the alert (ACCEPTANCE_TIMEOUT_MINUTES=0) does not switch off the hard limit — nor does ACCEPTANCE_DEADLINE_MINUTES=0", async () => {
    const w = silentRestaurant({ ACCEPTANCE_TIMEOUT_MINUTES: "0", ACCEPTANCE_DEADLINE_MINUTES: "0" });
    const order = await placedOrder(w);
    w.advance(61 * MINUTE);
    await runCron(w);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "rejected", payment_status: "canceled" });
  });

  it("the automatic-decline alert says how long the order really waited (61 min here, not the 30 of the other clock)", async () => {
    const w = world({ ...WHATSAPP_ENV, ACCEPTANCE_TIMEOUT_MINUTES: "30" });
    w.whatsapp.setTemplateStatus("pedido_nuevo", "PENDING"); // the new-order alert never goes out
    const order = await placedOrder(w);
    w.advance(61 * MINUTE);
    await runCron(w);
    const cancelled = w.whatsapp.messages().filter((m: { template: string }) => m.template === "pedido_cancelado");
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0].params.slice(0, 3)).toEqual([`#${order.orderNumber}`, "SHANG HAI (PRUEBA, no preparar)", "61"]);
  });
});

describe("in review with the money only held", () => {
  it("released at the limit counted from when the incident began (Stripe read first)", async () => {
    const w = silentRestaurant();
    const order = await reviewedOrder(w);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "needs_review", payment_status: "authorized" });
    w.advance(59 * MINUTE);
    await runCron(w);
    expect(orderRow(w.env, order.orderId)?.status).toBe("needs_review");

    w.advance(2 * MINUTE);
    const mark = w.net.stripeCalls.length;
    await runCron(w);
    const calls = callsSince(w, mark);
    const cancel = calls.indexOf(`POST /v1/payment_intents/${pi(w, order.orderId)}/cancel`);
    expect(cancel).toBeGreaterThan(0);
    expect(calls.slice(0, cancel)).toContain(`GET /v1/payment_intents/${pi(w, order.orderId)}`);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "rejected", payment_status: "canceled", review_reason: null });
    expect(w.stripe.intent(pi(w, order.orderId)).status).toBe("canceled");
  });

  it("an incident that began late gets the full time from when it began", async () => {
    const w = silentRestaurant();
    const order = await placedOrder(w);
    const cookie = await staffCookie(w.env, "Móvil A", w.now());
    w.advance(50 * MINUTE);
    w.stripe.failNext({ method: "GET", path: /^\/v1\/payment_intents\//, status: 401 }); // Stripe refuses the read: review
    expect((await staffAction(w, cookie, order.orderId, "accept", { prepMinutes: 15 })).status).toBe(502);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "needs_review", payment_status: "authorized" });

    w.advance(11 * MINUTE); // 61 min after payment, 11 after the incident
    await runCron(w);
    expect(orderRow(w.env, order.orderId)?.status).toBe("needs_review");
    w.advance(50 * MINUTE); // 61 min after the incident
    await runCron(w);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "rejected", payment_status: "canceled" });
  });

  it("money Stripe shows as charged (captured from the Dashboard, webhook lost) is never refunded by the system: it stays in review", async () => {
    const w = silentRestaurant();
    const order = await reviewedOrder(w);
    w.stripe.handle("POST", `/v1/payment_intents/${pi(w, order.orderId)}/capture`, new URLSearchParams(), {});
    w.stripe.takeEvents();
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "needs_review", payment_status: "authorized" });

    w.advance(3 * 60 * MINUTE);
    const mark = w.net.stripeCalls.length;
    await runCron(w);
    await runCron(w);
    expect(callsSince(w, mark).filter((c) => c.startsWith("POST"))).toEqual([]);
    expect(refundsOf(w, order.orderId)).toHaveLength(0);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "needs_review", payment_status: "captured" });
  });

  it("charged from the Dashboard between the cron's read and its cancel: still not refunded, back to review", async () => {
    const w = silentRestaurant();
    const order = await reviewedOrder(w);
    w.advance(61 * MINUTE);
    const inner = w.deps.fetch;
    let reads = 0;
    w.deps.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes(`/v1/payment_intents/${pi(w, order.orderId)}`) && (init?.method ?? "GET") === "GET" && ++reads === 2) {
        w.stripe.handle("POST", `/v1/payment_intents/${pi(w, order.orderId)}/capture`, new URLSearchParams(), {}); // the owner, right now
      }
      return inner(input, init);
    }) as typeof fetch;
    await runCron(w);
    expect(refundsOf(w, order.orderId)).toHaveLength(0);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "needs_review", payment_status: "captured" });
    expect(String(orderRow(w.env, order.orderId)?.review_reason)).toMatch(/no lo devuelve por su cuenta/);
  });

  it("the same holds when that release is finished by the lock's recovery (the Worker died half-way)", async () => {
    const w = silentRestaurant();
    const order = await reviewedOrder(w);
    w.advance(61 * MINUTE);
    w.stripe.failNext({ method: "POST", path: /\/cancel$/, network: true }); // the cancel never reaches Stripe…
    w.stripe.failNext({ method: "GET", path: /^\/v1\/payment_intents\//, network: true, skip: 2 }); // …and the check after it gets no answer
    await runCron(w);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "rejecting", payment_status: "authorized" });

    w.stripe.handle("POST", `/v1/payment_intents/${pi(w, order.orderId)}/capture`, new URLSearchParams(), {}); // the owner charges it meanwhile
    w.advance(2 * MINUTE); // the lock expires: recovery
    await runCron(w);
    expect(refundsOf(w, order.orderId)).toHaveLength(0);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "needs_review", payment_status: "captured" });
  });

  it("an incident whose money was charged is left to a person", async () => {
    const w = silentRestaurant({ STRIPE_CAPTURE_MODE: "per-method" });
    const order = await reviewedOrder(w, "capture");
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "needs_review", payment_status: "captured" });
    w.advance(3 * 60 * MINUTE);
    await runCron(w);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "needs_review", payment_status: "captured" });
    expect(refundsOf(w, order.orderId)).toHaveLength(0);
  });
});

describe("the automatic decline acts only on what it selected", () => {
  it("an order a phone accepts while the cron is busy declining another one is never declined or refunded", async () => {
    const w = world({ ACCEPTANCE_TIMEOUT_MINUTES: "30" }); // Telegram tells the restaurant at once
    const first = await placedOrder(w);
    const second = await placedOrder(w);
    const cookie = await staffCookie(w.env, "Móvil A", w.now());
    w.advance(31 * MINUTE);
    // The cron's first Stripe request (about the first order) is slow; meanwhile a phone accepts the second.
    const gate = gateStripe(w, (url) => url.includes(`/v1/payment_intents/${pi(w, first.orderId)}`));
    const cron = runCron(w);
    await gate.arrived;
    expect((await staffAction(w, cookie, second.orderId, "accept", { prepMinutes: 20 })).status).toBe(200);
    gate.release();
    await cron;
    expect(orderRow(w.env, second.orderId)).toMatchObject({ status: "preparing", payment_status: "captured" });
    expect(refundsOf(w, second.orderId)).toHaveLength(0);
    expect(orderRow(w.env, first.orderId)).toMatchObject({ status: "rejected", payment_status: "canceled" });
  });
});

describe("ACCEPTANCE_DEADLINE_MINUTES", () => {
  it.each([
    [{}, 60],
    [{ ACCEPTANCE_DEADLINE_MINUTES: "90" }, 90],
    [{ ACCEPTANCE_DEADLINE_MINUTES: "0" }, 60], // cannot be switched off
    [{ ACCEPTANCE_DEADLINE_MINUTES: "nunca" }, 60],
    [{ ACCEPTANCE_DEADLINE_MINUTES: "5000" }, 60], // over 24 h: back to the default
    [{ ACCEPTANCE_DEADLINE_MINUTES: "20", ACCEPTANCE_TIMEOUT_MINUTES: "30" }, 30], // never shorter than the timeout
    [{ ACCEPTANCE_TIMEOUT_MINUTES: "120" }, 120],
    [{ ACCEPTANCE_TIMEOUT_MINUTES: "0" }, 60],
  ])("%j → %i min", (vars, minutes) => {
    expect(acceptanceDeadlineMinutes(vars as Env)).toBe(minutes);
  });
});
