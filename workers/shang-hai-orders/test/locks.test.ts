import { describe, expect, it } from "vitest";
import {
  deliver,
  gateStripe,
  orderRow,
  placedOrder,
  runCron,
  staffAction,
  staffCall,
  staffCookie,
  world,
  type World,
} from "./helpers";

/**
 * Accept/reject locks have an owner and an expiry (migration 0003; QA audit PAY-F1/F2).
 * Property under test: nobody — another phone's REINTENTAR, the cron, the automatic decline —
 * can undo or decline an order whose payment operation may still be running, and an
 * abandoned lock is always recovered from Stripe's real state, visibly.
 */

const pi = (w: World, id: string) => orderRow(w.env, id)?.stripe_payment_intent_id as string;
const executedCaptures = (w: World, id: string) => {
  const intent = w.stripe.intent(pi(w, id));
  return intent.status === "succeeded" ? 1 : 0;
};
const refundsOf = (w: World, id: string) => [...w.stripe.state.refunds.values()].filter((r) => r.payment_intent === pi(w, id));

describe("a lock still in use is never undone", () => {
  it("REINTENTAR from another phone during a capture is refused; the acceptance finishes, charged once, never refunded", async () => {
    const w = world();
    const order = await placedOrder(w);
    const [phoneA, phoneB] = [await staffCookie(w.env, "Móvil A", w.now()), await staffCookie(w.env, "Móvil B", w.now())];
    const gate = gateStripe(w, (url) => url.endsWith("/capture"));
    const accepting = staffAction(w, phoneA, order.orderId, "accept", { prepMinutes: 20 });
    await gate.arrived;

    const board = (await (await staffCall(w, phoneB, "/api/admin/board")).json()) as { columns: { new: { id: string; actions: string[] }[] } };
    expect(board.columns.new.find((c) => c.id === order.orderId)?.actions).toEqual([]); // no button…
    const retry = await staffAction(w, phoneB, order.orderId, "retry"); // …and the server refuses too
    expect(retry.status).toBe(409);
    expect(retry.body.error).toBe("in-progress");

    gate.release();
    const accepted = await accepting;
    expect(accepted.status).toBe(200);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "preparing", payment_status: "captured", lock_token: null });
    await deliver(w, w.stripe.takeEvents());
    w.advance(31 * 60_000);
    await runCron(w);
    expect(orderRow(w.env, order.orderId)?.status).toBe("preparing");
    expect(refundsOf(w, order.orderId)).toHaveLength(0);
  });

  it("the cron leaves a lock alone until it expires (a slow Stripe call is not an abandoned one)", async () => {
    const w = world();
    const order = await placedOrder(w);
    const gate = gateStripe(w, (url) => url.endsWith("/capture"));
    const accepting = staffAction(w, await staffCookie(w.env, "Móvil A", w.now()), order.orderId, "accept", { prepMinutes: 20 });
    await gate.arrived;
    w.advance(60_000);
    expect((await runCron(w)).locks).toBe(0);
    expect(orderRow(w.env, order.orderId)?.status).toBe("accepting");
    gate.release();
    expect((await accepting).status).toBe(200);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "preparing", payment_status: "captured" });
  });

  it("even a request that outlives its lock cannot finish over the recovery: the order ends IN REVIEW, never auto-declined, never refunded behind anyone's back", async () => {
    const w = world({ ACCEPTANCE_TIMEOUT_MINUTES: "30" });
    const order = await placedOrder(w);
    w.advance(29 * 60_000); // staff accept in time, at minute 29
    const gate = gateStripe(w, (url) => url.endsWith("/capture"));
    const cookie = await staffCookie(w.env, "Móvil A", w.now());
    const accepting = staffAction(w, cookie, order.orderId, "accept", { prepMinutes: 20 });
    await gate.arrived;

    w.advance(91_000); // impossible with the Stripe timeouts, simulated: the lock expired under its owner
    const report = await runCron(w);
    expect(report).toMatchObject({ locks: 1, timeouts: 0 });
    // Stripe still showed the hold uncaptured: made visible, not silently undone.
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "needs_review", payment_status: "authorized" });
    expect(String(orderRow(w.env, order.orderId)?.review_reason)).toMatch(/no llegó a cobrarse/);

    gate.release(); // the old request's capture finally reaches Stripe and is charged…
    const late = await accepting;
    expect(late.status).toBe(409); // …but it is no longer the owner: it cannot move the order
    expect(executedCaptures(w, order.orderId)).toBe(1);

    await deliver(w, w.stripe.takeEvents()); // Stripe's webhooks bring the truth: charged
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "needs_review", payment_status: "captured" });
    w.advance(20 * 60_000);
    await runCron(w);
    expect(orderRow(w.env, order.orderId)?.status).toBe("needs_review"); // no automatic decline of a charged order
    expect(refundsOf(w, order.orderId)).toHaveLength(0);

    // A person accepts it: Stripe is read first, nothing is charged again.
    const again = await staffAction(w, cookie, order.orderId, "accept", { prepMinutes: 20 });
    expect(again.status).toBe(200);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "preparing", payment_status: "captured" });
    expect(w.stripe.intent(pi(w, order.orderId)).amount_received).toBe(orderRow(w.env, order.orderId)?.total_cents);
  });

  it("two recoveries at once (two cron runs, or a cron run and REINTENTAR) act once", async () => {
    const w = world();
    const order = await placedOrder(w);
    w.stripe.failNext({ method: "POST", path: /\/capture$/, network: true, afterExecute: true });
    w.stripe.failNext({ method: "GET", path: /^\/v1\/payment_intents\//, network: true, skip: 1 });
    expect((await staffAction(w, await staffCookie(w.env, "Móvil A", w.now()), order.orderId, "accept", { prepMinutes: 20 })).status).toBe(202);
    w.advance(2 * 60_000);
    await Promise.all([runCron(w), runCron(w), staffAction(w, await staffCookie(w.env, "Móvil B", w.now()), order.orderId, "retry")]);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "preparing", payment_status: "captured" });
    const finished = w.env.DB.raw.prepare("SELECT COUNT(*) AS n FROM order_events WHERE order_id = ? AND to_status = 'preparing'").get(order.orderId) as { n: number };
    expect(Number(finished.n)).toBe(1);
  });
});

describe("the automatic decline never overrides a staff decision", () => {
  it("an acceptance that failed to charge (Stripe 500) is not declined while staff retry it", async () => {
    const w = world({ ACCEPTANCE_TIMEOUT_MINUTES: "30" });
    const order = await placedOrder(w);
    const cookie = await staffCookie(w.env, "Móvil A", w.now());
    w.advance(29 * 60_000);
    w.stripe.failNext({ method: "POST", path: /\/capture$/, status: 500 });
    const first = await staffAction(w, cookie, order.orderId, "accept", { prepMinutes: 15 });
    expect(first.status).toBe(502);
    expect(String(first.body.message)).toMatch(/No se ha cobrado nada/);
    expect(orderRow(w.env, order.orderId)?.status).toBe("awaiting_acceptance");

    w.advance(2 * 60_000); // minute 31: past the 30-minute timeout
    expect((await runCron(w)).timeouts).toBe(0);
    expect(orderRow(w.env, order.orderId)?.status).toBe("awaiting_acceptance");

    const again = await staffAction(w, cookie, order.orderId, "accept", { prepMinutes: 15 }); // a new key: Stripe's stored 500 is not replayed
    expect(again.status).toBe(200);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "preparing", payment_status: "captured" });
  });

  it("without any staff decision, the timeout still declines (and only then)", async () => {
    const w = world({ ACCEPTANCE_TIMEOUT_MINUTES: "30" });
    const order = await placedOrder(w);
    w.advance(31 * 60_000);
    expect((await runCron(w)).timeouts).toBe(1);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "rejected", payment_status: "canceled" });
  });

  it("a failed acceptance from EN REVISIÓN goes back to EN REVISIÓN, keeping why it was there", async () => {
    const w = world();
    const order = await placedOrder(w);
    w.env.DB.raw.prepare("UPDATE orders SET status = 'needs_review', review_reason = 'Revisar alérgenos con el cliente' WHERE id = ?").run(order.orderId);
    w.stripe.failNext({ method: "POST", path: /\/capture$/, status: 500 });
    const res = await staffAction(w, await staffCookie(w.env, "Móvil A", w.now()), order.orderId, "accept", { prepMinutes: 15 });
    expect(res.status).toBe(502);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "needs_review", review_reason: "Revisar alérgenos con el cliente", lock_token: null });
  });
});

describe("simultaneous decisions", () => {
  it("ACEPTAR and RECHAZAR at the same time (as the panel sends them): exactly one wins and Stripe is changed once", async () => {
    for (let round = 0; round < 6; round++) {
      const w = world();
      const order = await placedOrder(w);
      const [a, b] = [await staffCookie(w.env, "Móvil A", w.now()), await staffCookie(w.env, "Móvil B", w.now())];
      const shown = { expectedStatus: "awaiting_acceptance" }; // both phones showed the new order
      const accept = () => staffAction(w, a, order.orderId, "accept", { prepMinutes: 20, ...shown });
      const reject = () => staffAction(w, b, order.orderId, "reject", { reason: "x", ...shown });
      const calls = round % 2 ? [accept(), reject()] : [reject(), accept()];
      const statuses = (await Promise.all(calls)).map((r) => r.status).sort();
      expect(statuses).toEqual([200, 409]);
      const status = orderRow(w.env, order.orderId)?.status;
      const intent = w.stripe.intent(pi(w, order.orderId)).status;
      expect([["preparing", "succeeded"], ["rejected", "canceled"]]).toContainEqual([status, intent]);
      const mutations = w.net.stripeCalls.filter((c) => /\/(capture|cancel)$/.test(c.url) || c.url.endsWith("/refunds")).filter((c) => c.method === "POST");
      expect(mutations).toHaveLength(1);
    }
  });
});

describe("actions apply only to what the phone showed", () => {
  it("RECHAZAR pressed on a new order is refused once another phone has accepted it (no charge-then-refund)", async () => {
    const w = world();
    const order = await placedOrder(w);
    const [a, b] = [await staffCookie(w.env, "Móvil A", w.now()), await staffCookie(w.env, "Móvil B", w.now())];
    expect((await staffAction(w, a, order.orderId, "accept", { prepMinutes: 20, expectedStatus: "awaiting_acceptance" })).status).toBe(200);
    const late = await staffAction(w, b, order.orderId, "reject", { reason: "x", expectedStatus: "awaiting_acceptance" });
    expect(late.status).toBe(409);
    expect(late.body.error).toBe("already-accepted");
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "preparing", payment_status: "captured" });
    expect(refundsOf(w, order.orderId)).toHaveLength(0);
    // Cancelling an accepted order is still possible — from the card that shows it accepted.
    expect((await staffAction(w, b, order.orderId, "reject", { reason: "x", expectedStatus: "preparing" })).status).toBe(200);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "rejected", payment_status: "refunded" });
  });
});

describe("locks taken before migration 0003", () => {
  it("a stale lock without owner (like the demo's order #1002) is recovered and made visible", async () => {
    const w = world();
    const order = await placedOrder(w);
    w.env.DB.raw.prepare("UPDATE orders SET status = 'accepting', lock_token = NULL, lock_expires_at = NULL, updated_at = ? WHERE id = ?").run(w.now().toISOString(), order.orderId);
    w.advance(30_000);
    expect((await runCron(w)).locks).toBe(0); // not stale yet
    w.advance(90_000);
    expect((await runCron(w)).locks).toBe(1);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "needs_review", payment_status: "authorized", lock_token: null });
  });
});
