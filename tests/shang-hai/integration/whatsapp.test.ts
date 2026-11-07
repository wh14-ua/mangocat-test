import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureSchema, migrate } from "../../../scripts/local-stack/run.mjs";
import { cloudState, customerView, d1, eventually, http, placedOrder, printLogsOnFailure, staff, staffSignIn, suiteStack, type Stack } from "./stack-client";

/**
 * WhatsApp Cloud API alerts on the real Worker (workerd + local D1) against the fake Cloud API:
 * the template goes out, the signed status webhooks reach the Worker and become delivery
 * receipts in D1, and failures (Meta unreachable, expired token, the Worker restarting) never
 * hide an order from the panel.
 */

let stack: Stack;
let cookie: string;
printLogsOnFailure(() => stack);

beforeAll(async () => {
  stack = suiteStack("whatsapp", 8940);
  migrate(stack.stateDir);
  ensureSchema(stack.stateDir);
  await stack.startCloud();
  await stack.startWorker();
  stack.startCron(3_000); // like Cloudflare's minute cron, faster: deferred and retried alerts are its job
  cookie = await staffSignIn(stack);
}, 180_000);

afterAll(async () => {
  await stack?.stopAll();
  if (stack && existsSync(stack.stateDir)) stack.wipe();
}, 60_000);

const control = (path: string, body: unknown) =>
  http(`${stack.urls.cloud}/__control/whatsapp/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

type AlertRow = { status: string; lastError: string | null; deliveredAt: string | null; readAt: string | null };

/**
 * The order's WhatsApp alert as the panel's order detail shows it (read through the Worker, as
 * the polling loops need: a second process on the SQLite file competes with the Worker's writes).
 */
async function whatsappAlert(orderId: string): Promise<AlertRow | undefined> {
  const order = (await staff(stack, cookie, `/api/admin/orders/${orderId}`)).body.order as { notifications?: (AlertRow & { channel: string; kind: string })[] } | undefined;
  return order?.notifications?.find((n) => n.channel === "whatsapp" && n.kind === "new_order");
}

async function board() {
  return (await staff(stack, cookie, "/api/admin/board")).body as unknown as {
    columns: Record<string, { id: string; alert: string }[]>;
    health: { whatsapp: { problem: { kind: string } | null; lastDeliveredAt: string | null } };
  };
}

describe("WhatsApp alerts on the real Worker", () => {
  it("the owner's WhatsApp gets the template; Meta's signed receipts mark it delivered in D1 and on the panel", async () => {
    const order = await placedOrder(stack);
    const message = await eventually(
      async () => (await cloudState(stack)).whatsapp.find((m) => m.template === "pedido_nuevo" && Boolean(m.button?.url?.endsWith(order.orderId))),
      "the WhatsApp alert",
    );
    expect(message.to).toBe("34600000001");
    expect(message.button?.url).toBe(`${stack.urls.worker}/admin?pedido=${order.orderId}`);
    await eventually(async () => Boolean((await whatsappAlert(order.orderId))?.deliveredAt), "the delivery receipt");
    const card = Object.values((await board()).columns).flat().find((c) => c.id === order.orderId);
    expect(card?.alert).toBe("delivered");
  }, 60_000);

  it("while Meta cannot reach the Worker the alert stays 'sent (unconfirmed)'; the retried webhook confirms it later", async () => {
    await control("webhooks", { paused: true });
    const order = await placedOrder(stack);
    await eventually(async () => (await whatsappAlert(order.orderId))?.status === "sent", "the API acceptance");
    expect((await whatsappAlert(order.orderId))?.deliveredAt).toBeNull();
    await control("webhooks", { paused: false });
    await eventually(async () => Boolean((await whatsappAlert(order.orderId))?.deliveredAt), "the late receipt");
  }, 60_000);

  it("an expired token: the order is on the panel, the panel says WhatsApp needs a new token, and the alert goes out once renewed", async () => {
    await control("token", { expired: true });
    let order;
    try {
      order = await placedOrder(stack);
      const id = order.orderId;
      await eventually(async () => (await whatsappAlert(id))?.lastError?.startsWith("190:"), "the 190 failure");
      const before = await board();
      expect(Object.values(before.columns).flat().some((c) => c.id === id)).toBe(true);
      expect(before.health.whatsapp.problem?.kind).toBe("credentials");
    } finally {
      await control("token", { expired: false }); // even if this test fails, the next one has a valid token
    }
    // The next attempt is 30 min away: bring it forward, then let the Worker's own cron run.
    d1(stack, `UPDATE notifications SET next_attempt_at = '2000-01-01T00:00:00.000Z' WHERE order_id = '${order.orderId}' AND channel = 'whatsapp'`);
    await eventually(async () => {
      await stack.runCron();
      return Boolean((await whatsappAlert(order.orderId))?.deliveredAt);
    }, "the alert after the token is renewed", 60_000);
    expect((await board()).health.whatsapp.problem).toBeNull();
  }, 90_000);

  it("WhatsApp failing for good: the hard limit still releases the customer's money (Stripe read before the cancel)", async () => {
    await control("token", { expired: true });
    try {
      const order = await placedOrder(stack);
      await eventually(async () => (await whatsappAlert(order.orderId))?.lastError?.startsWith("190:"), "the 190 failure");
      // Nobody was told and nobody opens the panel. Two hours pass (one-off write: the payment's time).
      const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString();
      d1(stack, `UPDATE orders SET authorized_at = '${twoHoursAgo}' WHERE id = '${order.orderId}'`);
      const before = (await cloudState(stack)).calls.length;
      const view = await eventually(async () => {
        await stack.runCron();
        const seen = await customerView(stack, order);
        return seen.status === "rejected" ? seen : null;
      }, "the decline at the hard limit", 60_000);
      expect(view).toMatchObject({ status: "rejected", paymentStatus: "canceled", rejectionReason: "El restaurante no ha podido confirmar el pedido a tiempo" });
      const cloud = await cloudState(stack);
      const intent = cloud.intents.find((i) => i.order === order.orderId);
      expect(intent?.status).toBe("canceled");
      const calls = cloud.calls.slice(before).map((c) => `${c.method} ${c.path.split("?")[0]}`);
      const cancel = calls.indexOf(`POST /v1/payment_intents/${intent?.id}/cancel`);
      expect(cancel).toBeGreaterThan(0);
      expect(calls.slice(0, cancel)).toContain(`GET /v1/payment_intents/${intent?.id}`);
    } finally {
      await control("token", { expired: false });
    }
  }, 90_000);

  it("receipts sent while the Worker restarts are retried by Meta and still arrive", async () => {
    const order = await placedOrder(stack);
    await eventually(async () => (await whatsappAlert(order.orderId))?.status === "sent", "the API acceptance");
    await control("webhooks", { paused: true });
    await stack.restartWorker();
    await control("webhooks", { paused: false });
    await eventually(async () => Boolean((await whatsappAlert(order.orderId))?.deliveredAt), "the receipt after the restart");
  }, 120_000);
});
