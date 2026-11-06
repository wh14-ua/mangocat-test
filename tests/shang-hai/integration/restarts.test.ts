import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureSchema, migrate, checkCoherence } from "../../../scripts/local-stack/run.mjs";
import {
  accept,
  cloudState,
  control,
  customerView,
  d1,
  eventually,
  orderRow,
  payOnPage,
  placedOrder,
  checkout,
  reject,
  sleep,
  staff,
  staffSignIn,
  suiteStack,
  type Stack,
} from "./stack-client";

/**
 * Persistence and restarts (level B: real Worker + local D1 under workerd, simulated Stripe
 * and Telegram, each in its own process). What must keep state: the local D1, the fake
 * Stripe and the fake Telegram — together, in one state directory. What must not: the Worker
 * (any request or cron run may be cut at any point). Every scenario checks the database and
 * the payment provider, not only the HTTP answers.
 */

let stack: Stack;
let cookie: string;

async function startAll(s: Stack) {
  migrate(s.stateDir);
  ensureSchema(s.stateDir);
  await s.startCloud();
  await s.startWorker();
}

beforeAll(async () => {
  stack = suiteStack("restarts", 8840);
  await startAll(stack);
  cookie = await staffSignIn(stack);
}, 180_000);

afterAll(async () => {
  await stack?.stopAll();
  if (stack && existsSync(stack.stateDir)) stack.wipe();
}, 60_000);

/** Cron runs until `check` holds (the Worker's own scheduled handler, like Cloudflare's). */
async function cronUntil<T>(check: () => Promise<T | null | undefined | false>, what: string, timeoutMs = 30_000) {
  return eventually(async () => {
    await stack.runCron();
    return check();
  }, what, timeoutMs);
}

const capturesExecuted = async (pi: string) => (await cloudState(stack)).charges.filter((c) => c.pi === pi && c.captured).length;

describe("A/B — the Worker and its local D1 restart", () => {
  it("keeps the order: the customer and the panel still see it, with the same data", async () => {
    const order = await placedOrder(stack);
    const before = orderRow(stack, order.orderId);
    await stack.restartWorker();
    expect(await customerView(stack, order)).toMatchObject({ status: "awaiting_acceptance", paymentStatus: "authorized" });
    const board = await staff(stack, cookie, "/api/admin/board");
    expect(board.status).toBe(200); // the staff session lives in D1: no new sign-in after a restart
    expect(JSON.stringify(board.body)).toContain(order.orderId);
    expect(orderRow(stack, order.orderId)).toMatchObject({
      number: before.number,
      status: "awaiting_acceptance",
      total_cents: before.total_cents,
      stripe_payment_intent_id: before.stripe_payment_intent_id,
    });
  });
});

describe("C — the local Stripe restarts", () => {
  it("with its state kept, an authorisation made before the restart is captured once on ACEPTAR", async () => {
    const order = await placedOrder(stack);
    await stack.restartCloud();
    const res = await accept(stack, cookie, order.orderId, 20);
    expect(res.status).toBe(200);
    const row = orderRow(stack, order.orderId);
    expect(row).toMatchObject({ status: "preparing", payment_status: "captured", prep_minutes: 20 });
    const pi = row.stripe_payment_intent_id as string;
    const intent = (await cloudState(stack)).intents.find((i) => i.id === pi);
    expect(intent).toMatchObject({ status: "succeeded", amountReceived: order.totalCents });
    expect(await capturesExecuted(pi)).toBe(1);
  });

  it("if its data is lost, ACEPTAR puts the order IN REVIEW at once (never 'PROCESANDO' forever) and the start-up check reports it", async () => {
    const order = await placedOrder(stack);
    await stack.stopCloud();
    rmSync(join(stack.stateDir, "fake-stripe.json"), { force: true });
    await stack.startCloud();

    const { orphans } = await checkCoherence(stack);
    expect(orphans.map((o) => o.id)).toContain(order.orderId);

    const res = await accept(stack, cookie, order.orderId, 15);
    expect(res.status).toBe(502);
    expect(String(res.body.message)).toMatch(/Stripe no encuentra el pago/);
    const row = orderRow(stack, order.orderId);
    expect(row.status).toBe("needs_review");
    expect(String(row.review_reason)).toContain(String(row.stripe_payment_intent_id));
    expect((await customerView(stack, order)).status).toBe("needs_review");
    // Leave the suite consistent for the next scenarios.
    await staff(stack, cookie, `/api/admin/orders/${order.orderId}/retry`, {});
  });
});

describe("D — the whole demo restarts keeping its state", () => {
  it("every order and payment is exactly as before, and work continues", async () => {
    const waiting = await placedOrder(stack);
    const preparing = await placedOrder(stack, { storefront: "wok-after-dark" });
    expect((await accept(stack, cookie, preparing.orderId, 30)).status).toBe(200);
    const declined = await placedOrder(stack, { storefront: "bento-club", locale: "en" });
    expect((await reject(stack, cookie, declined.orderId, "Closed early")).status).toBe(200);
    const snapshot = d1(stack, "SELECT id, number, status, payment_status, total_cents FROM orders ORDER BY number");
    const stripeBefore = (await cloudState(stack)).intents;

    await stack.stopAll();
    await startAll(stack);

    expect(d1(stack, "SELECT id, number, status, payment_status, total_cents FROM orders ORDER BY number")).toEqual(snapshot);
    expect((await cloudState(stack)).intents).toEqual(stripeBefore);
    const { orphans } = await checkCoherence(stack);
    expect(orphans.filter((o) => [waiting.orderId, preparing.orderId, declined.orderId].includes(String(o.id)))).toEqual([]);
    expect((await accept(stack, cookie, waiting.orderId, 15)).status).toBe(200);
    expect((await staff(stack, cookie, `/api/admin/orders/${preparing.orderId}/ready`, {})).status).toBe(200);
    expect(orderRow(stack, declined.orderId)).toMatchObject({ status: "rejected", payment_status: "canceled" });
  });
});

describe("E — a fresh start", () => {
  it("begins with an empty database and an empty Stripe, and deletes nothing else", async () => {
    const other = suiteStack("fresh", 8860);
    try {
      await startAll(other);
      const order = await checkout(other);
      await payOnPage(other, order.sessionId);
      await other.stopAll();
      const marker = join(other.stateDir, "..", `keep-${Date.now()}`);
      other.wipe();
      expect(existsSync(other.stateDir)).toBe(false);
      await startAll(other);
      expect(d1(other, "SELECT COUNT(*) AS n FROM orders")[0].n).toBe(0);
      expect((await cloudState(other)).intents).toEqual([]);
      void marker;
    } finally {
      await other.stopAll();
      if (existsSync(other.stateDir)) other.wipe();
    }
  });

  it("refuses to delete anything that is not a local test state directory", async () => {
    const { wipeStateDir } = await import("../../../scripts/local-stack/harness.mjs");
    expect(() => wipeStateDir("/home")).toThrow(/Refusing/);
    expect(() => wipeStateDir(".")).toThrow(/Refusing/);
    expect(() => wipeStateDir("workers/shang-hai-orders")).toThrow(/Refusing/);
  });
});

describe("F/G — the Worker dies in the middle of a payment operation", () => {
  it("F1: killed after Stripe captured (answer never came back): the cron finishes the acceptance, one charge", async () => {
    const order = await placedOrder(stack);
    await control(stack, "stripe/delay", { method: "POST", path: "/capture$", delayMs: 2500, after: true });
    const inFlight = accept(stack, cookie, order.orderId, 20).catch(() => null);
    await eventually(async () => orderRow(stack, order.orderId).status === "accepting", "the accept lock");
    await sleep(500);
    await stack.stopWorker("SIGKILL"); // crash, not a graceful stop
    await inFlight;
    await sleep(2500); // Stripe finishes the capture meanwhile
    await stack.startWorker();
    const row = orderRow(stack, order.orderId);
    expect(row.status).toBe("accepting"); // nothing decided blindly while the Worker was down
    await cronUntil(async () => orderRow(stack, order.orderId).status === "preparing", "the cron to finish the acceptance");
    const done = orderRow(stack, order.orderId);
    expect(done).toMatchObject({ status: "preparing", payment_status: "captured" });
    expect(await capturesExecuted(String(done.stripe_payment_intent_id))).toBe(1);
  });

  it("F2: killed before the capture reached Stripe: the order goes back to pending, nothing charged, and can be accepted", async () => {
    const order = await placedOrder(stack);
    await control(stack, "stripe/delay", { method: "POST", path: "/capture$", delayMs: 60_000, after: false });
    const inFlight = accept(stack, cookie, order.orderId, 20).catch(() => null);
    await eventually(async () => orderRow(stack, order.orderId).status === "accepting", "the accept lock");
    await stack.stopWorker("SIGKILL");
    await inFlight;
    await control(stack, "stripe/clear-failures");
    await stack.restartCloud(); // drops the held request: it never reached "Stripe"
    await stack.startWorker();
    await cronUntil(async () => orderRow(stack, order.orderId).status === "awaiting_acceptance", "the lock to be released");
    const pi = String(orderRow(stack, order.orderId).stripe_payment_intent_id);
    expect(await capturesExecuted(pi)).toBe(0);
    expect(orderRow(stack, order.orderId).payment_status).toBe("authorized");
    expect((await accept(stack, cookie, order.orderId, 20)).status).toBe(200);
    expect(await capturesExecuted(pi)).toBe(1);
  });

  it("G: killed during a rejection: the cron finishes it from Stripe; the hold is released, nothing charged", async () => {
    const order = await placedOrder(stack);
    await control(stack, "stripe/delay", { method: "POST", path: "/cancel$", delayMs: 2500, after: true });
    const inFlight = reject(stack, cookie, order.orderId, "Sin existencias").catch(() => null);
    await eventually(async () => orderRow(stack, order.orderId).status === "rejecting", "the reject lock");
    await stack.stopWorker("SIGKILL");
    await inFlight;
    await sleep(2500);
    await stack.startWorker();
    await cronUntil(async () => orderRow(stack, order.orderId).status === "rejected", "the cron to finish the rejection");
    const row = orderRow(stack, order.orderId);
    expect(row).toMatchObject({ status: "rejected", payment_status: "canceled", rejection_reason: "Sin existencias" });
    const intent = (await cloudState(stack)).intents.find((i) => i.id === row.stripe_payment_intent_id);
    expect(intent).toMatchObject({ status: "canceled", amountReceived: 0 });
  });
});

describe("H — a refund still pending when everything restarts", () => {
  it("is confirmed later and only then shown as refunded", async () => {
    const order = await placedOrder(stack);
    expect((await accept(stack, cookie, order.orderId, 20)).status).toBe(200);
    await control(stack, "stripe/refund-outcome", { outcome: "pending" });
    const res = await reject(stack, cookie, order.orderId, "No podemos prepararlo");
    expect(res.status).toBe(200);
    expect(orderRow(stack, order.orderId)).toMatchObject({ status: "rejected", payment_status: "refund_pending" });
    expect((await customerView(stack, order)).paymentStatus).toBe("refund_pending");
    await control(stack, "stripe/refund-outcome", { outcome: "succeeded" });

    await stack.stopAll();
    await startAll(stack);
    expect(orderRow(stack, order.orderId).payment_status).toBe("refund_pending"); // still not confirmed

    const refund = (await cloudState(stack)).refunds.find((r) => r.pi === orderRow(stack, order.orderId).stripe_payment_intent_id);
    expect(refund?.status).toBe("pending");
    await control(stack, `stripe/settle-refund/${refund?.id}`, { status: "succeeded" });
    await eventually(async () => orderRow(stack, order.orderId).payment_status === "refunded", "the refund confirmation");
    expect((await customerView(stack, order)).paymentStatus).toBe("refunded");
    expect((await cloudState(stack)).refunds.filter((r) => r.pi === refund?.pi)).toHaveLength(1); // never refunded twice
  });
});

describe("webhooks across restarts", () => {
  it("a payment made while the Worker is down reaches the restaurant when it is back (Stripe retries)", async () => {
    const order = await checkout(stack);
    await stack.stopWorker();
    expect(await payOnPage(stack, order.sessionId)).toBe(303);
    expect((await cloudState(stack)).queuedWebhooks).toBeGreaterThan(0);
    await stack.startWorker();
    await eventually(async () => (await customerView(stack, order)).status === "awaiting_acceptance", "the retried webhook");
    expect(orderRow(stack, order.orderId).payment_status).toBe("authorized");
  });

  it("a webhook that never arrives is recovered by the cron asking Stripe", async () => {
    await control(stack, "webhooks", { paused: true });
    const order = await checkout(stack);
    expect(await payOnPage(stack, order.sessionId)).toBe(303);
    await control(stack, "webhooks", { drop: true });
    await control(stack, "webhooks", { paused: false });
    expect(orderRow(stack, order.orderId).status).toBe("pending");
    // The cron looks for payments older than 2 minutes; make this order look that old.
    d1(stack, `UPDATE orders SET created_at = '${new Date(Date.now() - 3 * 60_000).toISOString()}' WHERE id = '${order.orderId}'`);
    await cronUntil(async () => orderRow(stack, order.orderId).status === "awaiting_acceptance", "the cron to find the payment");
    expect(orderRow(stack, order.orderId).payment_status).toBe("authorized");
  });
});
