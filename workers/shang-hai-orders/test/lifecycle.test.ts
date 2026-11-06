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
  staffCall,
  staffCookie,
  world,
  type World,
} from "./helpers";

async function staff(w: World) {
  return staffCookie(w.env, "Móvil de cocina", w.now());
}

describe("authorise → restaurant decides → capture", () => {
  it("runs the whole happy path and tells the customer the truth at every step", async () => {
    const w = world();
    const order = await createOrder(w);
    expect(await customerView(w, order)).toMatchObject({ status: "pending", paymentStatus: "unpaid", number: 1001 });

    // The customer authorises the payment on Stripe's page.
    await pay(w, order.sessionId);
    const pi = orderRow(w.env, order.orderId)?.stripe_payment_intent_id as string;
    expect(w.stripe.intent(pi).status).toBe("requires_capture");
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "awaiting_acceptance", payment_status: "authorized" });
    // Not charged yet, and the customer is told so.
    expect(await customerView(w, order)).toMatchObject({ status: "awaiting_acceptance", paymentStatus: "authorized" });
    expect((await customerView(w, order)).prepMinutes).toBeUndefined();

    // The restaurant got one alert per authorised chat, without personal data.
    const alerts = w.telegram.messages();
    expect(alerts).toHaveLength(2);
    expect(alerts.map((m) => m.chat_id).sort()).toEqual(["-1002222222222", "111111111"]);
    const text = alerts[0].text;
    expect(text).toContain("NUEVO PEDIDO — SHANG HAI");
    expect(text).toContain("#1001");
    expect(text).toContain("3 productos");
    expect(text).toContain("46,55");
    expect(text).toContain("PRUEBA");
    for (const secret of ["Lucía", "612", "lucia@example.es", "Sin cebolla"]) expect(text).not.toContain(secret);
    expect(alerts[0].button).toEqual({ text: "VER PEDIDO", url: `https://orders.example.workers.dev/admin#pedido=${order.orderId}` });

    // ACEPTAR with 20 minutes.
    const cookie = await staff(w);
    const accepted = await staffAction(w, cookie, order.orderId, "accept", { prepMinutes: 20 });
    expect(accepted.status).toBe(200);
    expect(accepted.body.order).toMatchObject({ status: "preparing", paymentStatus: "captured", prepMinutes: 20 });
    expect(w.stripe.intent(pi).status).toBe("succeeded");
    const captures = w.net.stripeCalls.filter((c) => c.url.endsWith("/capture"));
    expect(captures).toHaveLength(1);
    expect(captures[0].headers.get("Idempotency-Key")).toBe(`capture-${order.orderId}-1`);

    const view = await customerView(w, order);
    expect(view).toMatchObject({ status: "preparing", paymentStatus: "captured", prepMinutes: 20 });
    expect(Date.parse(String(view.readyBy)) - Date.parse(String(view.acceptedAt))).toBe(20 * 60_000);

    // The webhooks Stripe sends after the capture change nothing.
    await deliver(w, w.stripe.takeEvents());
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "preparing", payment_status: "captured" });

    expect((await staffAction(w, cookie, order.orderId, "ready")).body.order).toMatchObject({ status: "ready" });
    expect(await customerView(w, order)).toMatchObject({ status: "ready" });
    expect((await staffAction(w, cookie, order.orderId, "complete")).body.order).toMatchObject({ status: "completed" });
    expect(await customerView(w, order)).toMatchObject({ status: "completed", paymentStatus: "captured" });

    // Every step is in the history, with who did it.
    const events = w.env.DB.raw
      .prepare("SELECT to_status, source, actor FROM order_events WHERE order_id = ? ORDER BY id")
      .all(order.orderId) as { to_status: string; source: string; actor: string | null }[];
    expect(events.map((e) => e.to_status)).toEqual(["pending", "awaiting_acceptance", "accepting", "preparing", "ready", "completed"]);
    expect(events.filter((e) => e.source === "staff").every((e) => e.actor === "Móvil de cocina")).toBe(true);
  });

  it("never sends an order to the kitchen before the payment is authorised", async () => {
    const w = world();
    const order = await createOrder(w);
    const cookie = await staff(w);
    const res = await staffAction(w, cookie, order.orderId, "accept", { prepMinutes: 20 });
    expect(res.status).toBe(409);
    expect(orderRow(w.env, order.orderId)?.status).toBe("pending");
    expect(w.net.stripeCalls.some((c) => c.url.endsWith("/capture"))).toBe(false);
  });

  it("validates the preparation time on the server", async () => {
    const w = world();
    const order = await placedOrder(w);
    const cookie = await staff(w);
    for (const prepMinutes of [0, 4, 181, 12.5, "20", null]) {
      const res = await staffAction(w, cookie, order.orderId, "accept", { prepMinutes });
      expect(res.status).toBe(422);
    }
    expect(orderRow(w.env, order.orderId)?.status).toBe("awaiting_acceptance");
    // A custom time within 5–180 is fine.
    expect((await staffAction(w, cookie, order.orderId, "accept", { prepMinutes: 35 })).body.order).toMatchObject({ prepMinutes: 35 });
  });

  it("lets only one of two simultaneous ACEPTAR taps through, and captures once", async () => {
    const w = world();
    const order = await placedOrder(w);
    const [a, b] = await Promise.all([staff(w), staffCookie(w.env, "Móvil de sala", w.now())]);
    const [first, second] = await Promise.all([
      staffAction(w, a, order.orderId, "accept", { prepMinutes: 20 }),
      staffAction(w, b, order.orderId, "accept", { prepMinutes: 30 }),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
    const loser = first.status === 409 ? first : second;
    expect(String(loser.body.message)).toMatch(/ya estaba aceptado|está aceptando/);
    expect(w.net.stripeCalls.filter((c) => c.url.endsWith("/capture"))).toHaveLength(1);
    expect(count(w.env, "SELECT COUNT(*) AS n FROM order_events WHERE order_id = ? AND to_status = 'accepting'", order.orderId)).toBe(1);
  });

  it("does not prepare an order whose authorisation expired: cancelled, nothing charged", async () => {
    const w = world();
    const order = await placedOrder(w);
    const pi = orderRow(w.env, order.orderId)?.stripe_payment_intent_id as string;
    w.stripe.expireAuthorization(pi); // Stripe released the hold (the webhook has not arrived yet)
    w.stripe.takeEvents();
    const res = await staffAction(w, await staff(w), order.orderId, "accept", { prepMinutes: 20 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("authorization-expired");
    expect(String(res.body.message)).toContain("NO prepares");
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "cancelled", payment_status: "canceled" });
    expect(await customerView(w, order)).toMatchObject({ status: "cancelled", paymentStatus: "canceled" });
  });

  it("keeps the order in ACEPTANDO when Stripe does not answer, and the cron finishes it from Stripe's state", async () => {
    const w = world();
    const order = await placedOrder(w);
    // The capture happens at Stripe but the answer is lost, and the retrieve also fails.
    w.stripe.failNext({ method: "POST", path: /\/capture$/, network: true, afterExecute: true });
    w.stripe.failNext({ method: "GET", path: /^\/v1\/payment_intents\//, network: true });
    const pi = orderRow(w.env, order.orderId)?.stripe_payment_intent_id as string;
    const res = await staffAction(w, await staff(w), order.orderId, "accept", { prepMinutes: 20 });
    expect(res.status).toBe(202);
    expect(res.body.pending).toBe(true);
    expect(String(res.body.message)).toContain("No prepares el pedido");
    expect(orderRow(w.env, order.orderId)?.status).toBe("accepting");
    expect(w.stripe.intent(pi).status).toBe("succeeded");

    // The customer still sees "pending acceptance", never "accepted" by mistake.
    expect((await customerView(w, order)).status).toBe("accepting");

    w.advance(2 * 60_000);
    await runCron(w);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "preparing", payment_status: "captured", prep_minutes: 20 });
  });

  it("puts a failed capture back to pending (nothing charged) so staff can retry", async () => {
    const w = world();
    const order = await placedOrder(w);
    w.stripe.failNext({ method: "POST", path: /\/capture$/, status: 500 });
    const cookie = await staff(w);
    const res = await staffAction(w, cookie, order.orderId, "accept", { prepMinutes: 15 });
    expect(res.status).toBe(502);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "awaiting_acceptance", payment_status: "authorized" });
    const again = await staffAction(w, cookie, order.orderId, "accept", { prepMinutes: 15 });
    expect(again.status).toBe(200);
    expect(again.body.order).toMatchObject({ status: "preparing" });
  });
});

describe("rejection", () => {
  it("releases the authorisation (no refund needed) and shows the reason to the customer", async () => {
    const w = world();
    const order = await placedOrder(w);
    const pi = orderRow(w.env, order.orderId)?.stripe_payment_intent_id as string;
    const res = await staffAction(w, await staff(w), order.orderId, "reject", { reason: "Nos hemos quedado sin pato" });
    expect(res.status).toBe(200);
    expect(res.body.order).toMatchObject({ status: "rejected", paymentStatus: "canceled", rejectionReason: "Nos hemos quedado sin pato" });
    expect(w.stripe.intent(pi).status).toBe("canceled");
    expect(w.net.stripeCalls.filter((c) => c.url.endsWith("/refunds"))).toHaveLength(0);
    expect(await customerView(w, order)).toMatchObject({
      status: "rejected",
      paymentStatus: "canceled",
      rejectionReason: "Nos hemos quedado sin pato",
    });
    // Late or repeated authorisation events cannot resurrect the order: the state is re-read from Stripe.
    await deliver(w, [
      w.stripe.event("payment_intent.amount_capturable_updated", { id: pi, object: "payment_intent", metadata: { order_id: order.orderId } }),
      w.stripe.event("checkout.session.completed", { id: order.sessionId, object: "checkout.session", payment_intent: pi, client_reference_id: order.orderId }),
    ]);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "rejected", payment_status: "canceled" });
    // And it can no longer be accepted.
    expect((await staffAction(w, await staff(w), order.orderId, "accept", { prepMinutes: 20 })).status).toBe(409);
  });

  it("refunds a payment that was charged at once (methods without manual capture) and waits for Stripe's confirmation", async () => {
    const w = world({ STRIPE_CAPTURE_MODE: "per-method" });
    const order = await placedOrder(w, {}, "capture");
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "awaiting_acceptance", payment_status: "captured" });
    w.stripe.setRefundOutcome("pending");
    const res = await staffAction(w, await staff(w), order.orderId, "reject", {});
    expect(res.status).toBe(200);
    expect(res.body.order).toMatchObject({ status: "rejected", paymentStatus: "refund_pending" });
    // Not presented as completed until Stripe confirms.
    expect((await customerView(w, order)).paymentStatus).toBe("refund_pending");
    const refund = orderRow(w.env, order.orderId)?.stripe_refund_id as string;
    await deliver(w, w.stripe.settleRefund(refund, "succeeded"));
    expect(await customerView(w, order)).toMatchObject({ status: "rejected", paymentStatus: "refunded" });
  });

  it("leaves a failed refund clearly IN REVIEW, alerts the staff, and lets them retry", async () => {
    const w = world({ STRIPE_CAPTURE_MODE: "per-method" });
    const order = await placedOrder(w, {}, "capture");
    w.stripe.setRefundOutcome("failed");
    const cookie = await staff(w);
    const res = await staffAction(w, cookie, order.orderId, "reject", { reason: "Cerrado" });
    expect(res.status).toBe(502);
    expect(res.body.order).toMatchObject({ status: "needs_review", paymentStatus: "refund_failed" });
    expect(String(res.body.message)).toContain("EN REVISIÓN");
    expect(String(orderRow(w.env, order.orderId)?.review_reason)).toContain("devolución ha fallado");
    expect(w.telegram.lastText()).toContain("necesita revisión");
    expect((await customerView(w, order)).paymentStatus).toBe("refund_failed");

    w.stripe.setRefundOutcome("succeeded");
    const retry = await staffAction(w, cookie, order.orderId, "reject", { reason: "Cerrado" });
    expect(retry.status).toBe(200);
    expect(retry.body.order).toMatchObject({ status: "rejected", paymentStatus: "refunded" });
    const keys = w.net.stripeCalls.filter((c) => c.url.endsWith("/refunds")).map((c) => c.headers.get("Idempotency-Key"));
    expect(keys).toEqual([`refund-${order.orderId}-1`, `refund-${order.orderId}-2`]);
  });

  it("cancels an accepted order with a refund when the kitchen cannot finish it", async () => {
    const w = world();
    const order = await placedOrder(w);
    const cookie = await staff(w);
    await staffAction(w, cookie, order.orderId, "accept", { prepMinutes: 20 });
    const res = await staffAction(w, cookie, order.orderId, "reject", { reason: "Avería en la cocina" });
    expect(res.body.order).toMatchObject({ status: "rejected", paymentStatus: "refunded" });
  });

  it("lets only one of two simultaneous RECHAZAR taps through", async () => {
    const w = world();
    const order = await placedOrder(w);
    const cookie = await staff(w);
    const results = await Promise.all([
      staffAction(w, cookie, order.orderId, "reject", {}),
      staffAction(w, cookie, order.orderId, "reject", {}),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(w.net.stripeCalls.filter((c) => c.url.endsWith("/cancel"))).toHaveLength(1);
  });
});

describe("payment problems before the restaurant sees anything", () => {
  it("a declined card leaves the order unpaid and the restaurant is not alerted", async () => {
    const w = world();
    const order = await createOrder(w);
    await pay(w, order.sessionId, "decline");
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "failed", payment_status: "failed" });
    expect(w.telegram.messages()).toHaveLength(0);
    // The customer retries with another card in the same session: now it reaches the restaurant.
    await pay(w, order.sessionId, "authorize");
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "awaiting_acceptance", payment_status: "authorized" });
    expect(w.telegram.messages()).toHaveLength(2);
  });

  it("an abandoned checkout is cancelled when the session expires (nothing charged)", async () => {
    const w = world();
    const order = await createOrder(w);
    await deliver(w, w.stripe.expireSession(order.sessionId));
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "cancelled", payment_status: "unpaid" });
    expect(w.telegram.messages()).toHaveLength(0);
  });

  it("an amount that does not match the order goes to review instead of the kitchen", async () => {
    const w = world();
    const order = await createOrder(w);
    w.stripe.session(order.sessionId).amount_total = CHECKOUT_TOTAL - 100;
    await pay(w, order.sessionId);
    expect(orderRow(w.env, order.orderId)?.status).toBe("needs_review");
    expect(String(orderRow(w.env, order.orderId)?.review_reason)).toContain("Importe");
  });
});

describe("timeouts and reminders (cron)", () => {
  it("reminds the staff, then declines and releases the hold if nobody answers", async () => {
    const w = world({ ACCEPTANCE_REMINDER_MINUTES: "4", ACCEPTANCE_TIMEOUT_MINUTES: "30" });
    const order = await placedOrder(w);
    expect(w.telegram.messages()).toHaveLength(2);

    w.advance(5 * 60_000);
    await runCron(w);
    expect(w.telegram.messages().filter((m) => m.text.includes("sin aceptar"))).toHaveLength(2);
    await runCron(w); // no duplicate reminders
    expect(w.telegram.messages().filter((m) => m.text.includes("sin aceptar"))).toHaveLength(2);

    w.advance(26 * 60_000);
    await runCron(w);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "rejected", payment_status: "canceled" });
    expect(await customerView(w, order)).toMatchObject({
      status: "rejected",
      paymentStatus: "canceled",
      rejectionReason: "El restaurante no ha podido confirmar el pedido a tiempo",
    });
    expect(w.telegram.messages().filter((m) => m.text.includes("cancelado automáticamente"))).toHaveLength(2);
  });

  it("never declines an order the restaurant could not see (alerts failed, panel not opened)", async () => {
    const w = world({ ACCEPTANCE_TIMEOUT_MINUTES: "30" });
    w.telegram.failNext({ status: 403 });
    w.telegram.failNext({ status: 403 });
    const order = await placedOrder(w);
    expect(count(w.env, "SELECT COUNT(*) AS n FROM notifications WHERE kind = 'new_order' AND status = 'sent'")).toBe(0);
    w.advance(3 * 60 * 60_000);
    await runCron(w);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "awaiting_acceptance", payment_status: "authorized" });

    // A staff phone opens the board: from now on the 30 minutes run.
    const cookie = await staff(w);
    await staffCall(w, cookie, "/api/admin/board");
    w.advance(29 * 60_000);
    await runCron(w);
    expect(orderRow(w.env, order.orderId)?.status).toBe("awaiting_acceptance");
    w.advance(2 * 60_000);
    await runCron(w);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "rejected", payment_status: "canceled" });
  });

  it("without Telegram configured, waits for the panel instead of declining blindly", async () => {
    const w = world({ TELEGRAM_BOT_TOKEN: "", TELEGRAM_CHAT_IDS: "" });
    const order = await placedOrder(w);
    w.advance(2 * 60 * 60_000);
    await runCron(w);
    expect(orderRow(w.env, order.orderId)?.status).toBe("awaiting_acceptance");
  });

  it("can switch the automatic decline off (0) until the owner confirms the policy", async () => {
    const w = world({ ACCEPTANCE_TIMEOUT_MINUTES: "0" });
    const order = await placedOrder(w);
    w.advance(5 * 60 * 60_000);
    await runCron(w);
    expect(orderRow(w.env, order.orderId)?.status).toBe("awaiting_acceptance");
    // Reminders still go out.
    expect(w.telegram.messages().some((m) => m.text.includes("sin aceptar"))).toBe(true);
  });

  it("recovers an authorisation whose webhook never arrived", async () => {
    const w = world();
    const order = await createOrder(w);
    w.stripe.completeSession(order.sessionId, "authorize");
    w.stripe.takeEvents(); // lost: never delivered
    expect(orderRow(w.env, order.orderId)?.status).toBe("pending");
    w.advance(3 * 60_000);
    await runCron(w);
    expect(orderRow(w.env, order.orderId)).toMatchObject({ status: "awaiting_acceptance", payment_status: "authorized" });
    expect(w.telegram.messages()).toHaveLength(2);
  });
});
