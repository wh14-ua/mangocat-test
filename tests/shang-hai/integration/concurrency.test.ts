import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureSchema, migrate } from "../../../scripts/local-stack/run.mjs";
import { accept, checkout, cloudState, customerView, d1, eventually, payOnPage, printLogsOnFailure, reject, staff, staffSignIn, suiteStack, type Placed, type Stack } from "./stack-client";

/**
 * Many customers and two phones at once, against the real Worker and its local D1 (bounded,
 * local only: nothing external is ever loaded). Checked in D1 and at the (fake) Stripe.
 */

let stack: Stack;
printLogsOnFailure(() => stack);
let cookie: string;

beforeAll(async () => {
  stack = suiteStack("concurrency", 8920);
  migrate(stack.stateDir);
  ensureSchema(stack.stateDir);
  await stack.startCloud();
  await stack.startWorker();
  stack.startCron(3_000); // like Cloudflare's minute cron, faster: retries and lost alerts are its job
  cookie = await staffSignIn(stack);
}, 180_000);

afterAll(async () => {
  await stack?.stopAll();
  if (stack && existsSync(stack.stateDir)) stack.wipe();
}, 60_000);

const CARTS = [
  { lines: [{ itemId: "combo-a", quantity: 1 }], total: 1945 },
  { lines: [{ itemId: "combo-a", quantity: 2 }, { itemId: "pollo-con-almendras", quantity: 1 }], total: 2 * 1945 + 765 },
  { lines: [{ itemId: "pollo-con-almendras", quantity: 3 }], total: 3 * 765 },
];
const STOREFRONTS = ["ink-house", "wok-after-dark", "bento-club"];

let placed: Placed[] = [];

describe("many customers at once", () => {
  it("30 simultaneous checkouts: 30 independent orders, unique consecutive numbers, exact totals", async () => {
    const results = await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        checkout(stack, {
          storefront: STOREFRONTS[i % 3],
          locale: i % 2 ? "en" : "es",
          lines: CARTS[i % 3].lines,
          expectedTotalCents: CARTS[i % 3].total,
          customer: { name: `Cliente ${i}`, phone: "612 345 678", email: `c${i}@example.es`, notes: "" },
        }, `198.51.100.${i + 1}`).then((o) => ({ ...o, totalCents: CARTS[i % 3].total })),
      ),
    );
    placed = results;
    const numbers = results.map((r) => r.orderNumber).sort((a, b) => a - b);
    expect(new Set(numbers).size).toBe(30);
    expect(numbers[29] - numbers[0]).toBe(29); // consecutive: no gaps, no duplicates
    const rows = d1(stack, "SELECT id, number, total_cents, storefront, locale FROM orders");
    expect(rows).toHaveLength(30);
    for (const r of results) {
      const row = rows.find((x) => x.id === r.orderId);
      expect(row).toMatchObject({ number: r.orderNumber, total_cents: r.totalCents });
    }
    const state = await cloudState(stack);
    expect(state.sessionIds).toHaveLength(30);
  }, 120_000);

  it("they all pay at once: every order reaches the restaurant once, with one alert per chat", async () => {
    await Promise.all(placed.map((o) => payOnPage(stack, o.sessionId)));
    // Followed like the customers do (their status pages), not by reading the database file.
    await eventually(
      async () => (await Promise.all(placed.map((o, i) => customerView(stack, o, `198.51.100.${i + 1}`)))).every((v) => v.status === "awaiting_acceptance"),
      "all 30 orders to be authorised",
      60_000,
    );
    const state = await cloudState(stack);
    for (const o of placed) {
      const intent = state.intents.find((i) => i.order === o.orderId);
      expect(intent).toMatchObject({ status: "requires_capture", amount: o.totalCents });
    }
    await eventually(async () => {
      const alerts = (await cloudState(stack)).telegram.filter((m) => m.text.includes("NUEVO PEDIDO"));
      return alerts.length >= 60 ? alerts : null;
    }, "60 new-order alerts", 60_000);
    // Per order and per channel, read through the panel's API (not the database file, which the
    // Worker keeps writing while the WhatsApp alerts go out one by one).
    for (const o of placed) {
      const detail = (await staff(stack, cookie, `/api/admin/orders/${o.orderId}`)).body.order as unknown as {
        notifications: { channel: string; kind: string; status: string; errorCode?: string | null; lastError: string | null }[];
      };
      const alerts = detail.notifications.filter((n) => n.kind === "new_order");
      expect(alerts.filter((n) => n.channel === "telegram" && n.status === "sent"), o.orderId).toHaveLength(2); // two chats, once each
      const whatsapp = alerts.filter((n) => n.channel === "whatsapp");
      expect(whatsapp, o.orderId).toHaveLength(1); // one alert to the owner's WhatsApp, never twice
      expect(whatsapp[0].lastError ?? "", o.orderId).not.toMatch(/131056/); // paced, never refused by the pair rate limit
    }
    // The owner's WhatsApp receives them one by one (Meta: ~1 message every 6 s to the same number,
    // counting the sign-in code sent moments ago), never twice.
    const messages = await eventually(async () => {
      const list = (await cloudState(stack)).whatsapp.filter((m) => m.template === "pedido_nuevo");
      return list.length >= 2 ? list : null;
    }, "the first paced WhatsApp alerts", 45_000);
    expect(new Set(messages.map((m) => m.button?.url)).size).toBe(messages.length);
    const views = await Promise.all(placed.map((o, i) => customerView(stack, o, `198.51.100.${i + 1}`)));
    expect(views.every((v) => v.status === "awaiting_acceptance" && v.paymentStatus === "authorized")).toBe(true);
  }, 120_000);
});

describe("two phones deciding the same orders at once", () => {
  it("ACEPTAR on one phone and RECHAZAR on the other, on ten orders in parallel: one decision per order, Stripe changed once", async () => {
    const targets = placed.slice(0, 10);
    const outcomes = await Promise.all(
      targets.map(async (o, i) => {
        const a = () => accept(stack, cookie, o.orderId, 20);
        const r = () => reject(stack, cookie, o.orderId, "Sin existencias");
        const [x, y] = await Promise.all(i % 2 ? [a(), r()] : [r(), a()]);
        return { id: o.orderId, statuses: [x.status, y.status].sort() };
      }),
    );
    for (const o of outcomes) expect(o.statuses, o.id).toEqual([200, 409]);
    const state = await cloudState(stack);
    for (const o of targets) {
      // Through the Worker: its background alerts are still being written (paced WhatsApp).
      const row = (await staff(stack, cookie, `/api/admin/orders/${o.orderId}`)).body.order as { status: string };
      const intent = state.intents.find((i) => i.order === o.orderId);
      if (row.status === "preparing") expect(intent).toMatchObject({ status: "succeeded", amountReceived: o.totalCents });
      else expect([row.status, intent?.status]).toEqual(["rejected", "canceled"]);
      const mutations = state.calls.filter((c) => c.method === "POST" && /\/(capture|cancel)$/.test(c.path) && c.path.includes(String(intent?.id)));
      expect(mutations, o.orderId).toHaveLength(1);
    }
  }, 120_000);

  it("the same phone tapping ACEPTAR five times on one order charges once", async () => {
    const o = placed[10];
    const taps = await Promise.all(Array.from({ length: 5 }, () => accept(stack, cookie, o.orderId, 15)));
    expect(taps.filter((t) => t.status === 200)).toHaveLength(1);
    expect(taps.filter((t) => t.status === 409)).toHaveLength(4);
    const intent = (await cloudState(stack)).intents.find((i) => i.order === o.orderId);
    expect(intent).toMatchObject({ status: "succeeded", amountReceived: o.totalCents });
  }, 60_000);
});

describe("rate limits", () => {
  it("one address cannot open more than 10 checkouts a minute (the 11th is refused, nothing created)", async () => {
    const before = d1(stack, "SELECT COUNT(*) AS n FROM orders")[0].n as number;
    const tries = await Promise.allSettled(Array.from({ length: 12 }, () => checkout(stack, {}, "203.0.113.50")));
    const created = tries.filter((t) => t.status === "fulfilled").length;
    expect(created).toBe(10);
    expect(tries.filter((t) => t.status === "rejected" && String(t.reason).includes("429"))).toHaveLength(2);
    expect(d1(stack, "SELECT COUNT(*) AS n FROM orders")[0].n).toBe(before + 10);
  }, 60_000);
});

describe("bounded load", () => {
  it("200 status lookups (20 at a time) all answer correctly and quickly", async () => {
    const latencies: number[] = [];
    for (let batch = 0; batch < 10; batch++) {
      await Promise.all(
        placed.slice(0, 20).map(async (o, i) => {
          const started = performance.now();
          const view = await customerView(stack, o, `198.51.100.${i + 1}`); // each customer polls from their phone
          latencies.push(performance.now() - started);
          expect(view.id).toBe(o.orderId);
        }),
      );
    }
    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    expect(latencies).toHaveLength(200);
    expect(p95).toBeLessThan(2_000);
  }, 120_000);
});
