import { describe, expect, it } from "vitest";
import {
  count,
  customerView,
  orderRow,
  placedOrder,
  runCron,
  staffAction,
  staffCookie,
  world,
  type World,
} from "./helpers";

/**
 * Payments whose outcome Stripe cannot confirm (bug B of the 2026-11-06 demo: order #1002
 * stayed "PROCESANDO — Aceptando: cobrando el pago en Stripe" for 30+ minutes because the
 * local Stripe had forgotten the PaymentIntent and every answer was a 404).
 *
 * Invariants: never mark captured without Stripe's confirmation; never capture twice; never
 * leave an order locked indefinitely — when the system cannot decide with certainty, the
 * order goes to EN REVISIÓN with what a person needs to act, and the staff are alerted.
 */

async function staff(w: World) {
  return staffCookie(w.env, "Móvil de cocina", w.now());
}

const pi = (w: World, id: string) => orderRow(w.env, id)?.stripe_payment_intent_id as string;

/** What a restarted in-memory Stripe stand-in looks like: it knows nothing any more. */
function forgetEverything(w: World) {
  for (const map of [w.stripe.state.sessions, w.stripe.state.intents, w.stripe.state.charges, w.stripe.state.refunds, w.stripe.state.idempotency]) {
    map.clear();
  }
}

const capturesThatHappened = (w: World) =>
  w.net.stripeCalls.filter((c) => c.url.endsWith("/capture")).length - w.stripe.state.failures.length;

describe("Stripe no longer knows the payment (404)", () => {
  it("an accept goes to review at once instead of staying ACEPTANDO forever", async () => {
    const w = world();
    const order = await placedOrder(w);
    forgetEverything(w);
    const res = await staffAction(w, await staff(w), order.orderId, "accept", { prepMinutes: 15 });

    expect(res.status).toBe(502);
    expect(res.body.error).toBe("needs-review");
    expect(String(res.body.message)).toMatch(/Stripe no encuentra el pago/);
    const row = orderRow(w.env, order.orderId);
    expect(row).toMatchObject({ status: "needs_review", payment_status: "authorized" });
    expect(String(row?.review_reason)).toContain(pi(w, order.orderId));
    // Never shown to the customer as accepted or charged.
    expect(await customerView(w, order)).toMatchObject({ status: "needs_review" });
    // The staff are told by Telegram, not only on the panel.
    expect(w.telegram.messages().some((m) => /revisi[oó]n/i.test(m.text))).toBe(true);
  });

  it("the cron escalates a lock whose PaymentIntent vanished instead of retrying it every minute", async () => {
    const w = world();
    const order = await placedOrder(w);
    // The accept request died with the outcome unknown (capture and re-read both lost)…
    w.stripe.failNext({ method: "POST", path: /\/capture$/, network: true });
    w.stripe.failNext({ method: "GET", path: /^\/v1\/payment_intents\//, network: true });
    expect((await staffAction(w, await staff(w), order.orderId, "accept", { prepMinutes: 20 })).status).toBe(202);
    // …and then the Stripe stand-in restarted without its data.
    forgetEverything(w);

    w.advance(2 * 60_000);
    await runCron(w);
    const row = orderRow(w.env, order.orderId);
    expect(row?.status).toBe("needs_review");
    expect(String(row?.review_reason)).toMatch(/Stripe no encuentra el pago/);
  });

  it("a rejection goes to review instead of staying RECHAZANDO", async () => {
    const w = world();
    const order = await placedOrder(w);
    forgetEverything(w);
    const res = await staffAction(w, await staff(w), order.orderId, "reject", { reason: "Sin existencias" });
    expect(res.status).toBe(502);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "needs_review" });
    // Nothing was released at Stripe, so the order is NOT presented as rejected with the hold cancelled.
    expect(orderRow(w.env, order.orderId)?.payment_status).toBe("authorized");
  });

  it("the retry button says Stripe cannot find the payment instead of 'todo al día'", async () => {
    const w = world();
    const order = await placedOrder(w);
    const cookie = await staff(w);
    forgetEverything(w);
    await staffAction(w, cookie, order.orderId, "accept", { prepMinutes: 15 });
    const retry = await staffAction(w, cookie, order.orderId, "retry");
    expect(String(retry.body.message)).not.toMatch(/al día/);
    expect(String(retry.body.message)).toMatch(/Stripe no encuentra el pago/);
    expect(orderRow(w.env, order.orderId)?.status).toBe("needs_review");
  });
});

describe("Stripe does not answer", () => {
  it("a lock is retried for a few minutes, then flagged for review with what to check", async () => {
    const w = world();
    const order = await placedOrder(w);
    const cookie = await staff(w);
    w.stripe.failNext({ method: "POST", path: /\/capture$/, network: true }); // never reached Stripe
    w.stripe.failNext({ method: "GET", path: /^\/v1\/payment_intents\//, network: true, times: 1000 }); // Stripe down
    expect((await staffAction(w, cookie, order.orderId, "accept", { prepMinutes: 20 })).status).toBe(202);

    for (let i = 0; i < 3; i++) {
      w.advance(60_000);
      await runCron(w);
    }
    expect(orderRow(w.env, order.orderId)?.status).toBe("accepting"); // still trying, nothing decided blindly

    for (let i = 0; i < 6; i++) {
      w.advance(60_000);
      await runCron(w);
    }
    const row = orderRow(w.env, order.orderId);
    expect(row).toMatchObject({ status: "needs_review", payment_status: "authorized" });
    expect(String(row?.review_reason)).toMatch(/Stripe no responde/);
    expect(String(row?.review_reason)).toContain(pi(w, order.orderId));
    expect(w.telegram.messages().some((m) => /revisi[oó]n/i.test(m.text))).toBe(true);

    // Stripe comes back: ACEPTAR from review captures exactly once.
    w.stripe.state.failures.length = 0;
    const again = await staffAction(w, cookie, order.orderId, "accept", { prepMinutes: 20 });
    expect(again.status).toBe(200);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "preparing", payment_status: "captured" });
    expect(w.stripe.intent(pi(w, order.orderId)).status).toBe("succeeded");
  });

  it("a lock whose capture DID happen (answer lost) is finished from review without a second charge", async () => {
    const w = world();
    const order = await placedOrder(w);
    const cookie = await staff(w);
    w.stripe.failNext({ method: "POST", path: /\/capture$/, network: true, afterExecute: true }); // charged, answer lost
    w.stripe.failNext({ method: "GET", path: /^\/v1\/payment_intents\//, network: true, times: 1000 });
    expect((await staffAction(w, cookie, order.orderId, "accept", { prepMinutes: 20 })).status).toBe(202);
    for (let i = 0; i < 8; i++) {
      w.advance(60_000);
      await runCron(w);
    }
    expect(orderRow(w.env, order.orderId)?.status).toBe("needs_review");
    // Until Stripe confirms, the order never claims the money was taken.
    expect(orderRow(w.env, order.orderId)?.payment_status).toBe("authorized");

    w.stripe.state.failures.length = 0;
    const again = await staffAction(w, cookie, order.orderId, "accept", { prepMinutes: 20 });
    expect(again.status).toBe(200);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "preparing", payment_status: "captured" });
    const charge = w.stripe.state.charges.get(w.stripe.intent(pi(w, order.orderId)).latest_charge);
    expect(charge.amount_captured).toBe(charge.amount); // captured once, for the order total
  });

  it("a Stripe call that hangs times out instead of freezing the request (lock kept, then resolved)", async () => {
    const w = world({ STRIPE_TIMEOUT_MS: "50" });
    const order = await placedOrder(w);
    const base = w.deps.fetch;
    let hung = 0;
    w.deps.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith("/capture") && hung++ === 0) {
        return new Promise<Response>((_, reject) => {
          const signal = init?.signal;
          if (!signal) return; // without a timeout this never settles: the test times out
          signal.addEventListener("abort", () => reject(signal.reason ?? new Error("aborted")));
        });
      }
      return base(input, init);
    };
    const res = await staffAction(w, await staff(w), order.orderId, "accept", { prepMinutes: 20 });
    // The capture never reached Stripe and the re-read says it is still held: back to pending.
    expect(res.status).toBe(502);
    expect(res.body.error).toBe("capture-failed");
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "awaiting_acceptance", payment_status: "authorized" });
  }, 5_000);
});

describe("Stripe errors that are replayed for the same idempotency key", () => {
  it("a capture that failed with a 500 can be retried (Stripe replays a stored 500 for the same key)", async () => {
    const w = world();
    const order = await placedOrder(w);
    const cookie = await staff(w);
    w.stripe.failNext({ method: "POST", path: /\/capture$/, status: 500 });
    const first = await staffAction(w, cookie, order.orderId, "accept", { prepMinutes: 15 });
    expect(first.status).toBe(502);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "awaiting_acceptance", payment_status: "authorized" });

    const again = await staffAction(w, cookie, order.orderId, "accept", { prepMinutes: 15 });
    expect(again.status).toBe(200);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "preparing", payment_status: "captured" });
    expect(capturesThatHappened(w)).toBeGreaterThanOrEqual(1);
    expect(w.stripe.intent(pi(w, order.orderId)).amount_received).toBe(orderRow(w.env, order.orderId)?.total_cents);
  });

  it("a cancellation that failed with a 500 can be retried", async () => {
    const w = world();
    const order = await placedOrder(w);
    const cookie = await staff(w);
    w.stripe.failNext({ method: "POST", path: /\/cancel$/, status: 500 });
    const first = await staffAction(w, cookie, order.orderId, "reject", { reason: "Cerramos antes" });
    expect(first.status).toBe(502);
    expect(orderRow(w.env, order.orderId)?.status).toBe("needs_review");
    const again = await staffAction(w, cookie, order.orderId, "reject", { reason: "Cerramos antes" });
    expect(again.status).toBe(200);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "rejected", payment_status: "canceled" });
    expect(w.stripe.intent(pi(w, order.orderId)).status).toBe("canceled");
  });

  it("a capture whose answer was lost is replayed by Stripe, not executed twice", async () => {
    const w = world();
    const order = await placedOrder(w);
    w.stripe.failNext({ method: "POST", path: /\/capture$/, network: true, afterExecute: true });
    const res = await staffAction(w, await staff(w), order.orderId, "accept", { prepMinutes: 20 });
    // The re-read sees the capture: finished in the same request.
    expect(res.status).toBe(200);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "preparing", payment_status: "captured" });
    expect(count(w.env, "SELECT COUNT(*) AS n FROM order_events WHERE order_id = ? AND to_status = 'preparing'", order.orderId)).toBe(1);
  });
});
