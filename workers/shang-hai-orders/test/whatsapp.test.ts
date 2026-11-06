import { describe, expect, it } from "vitest";
import { cleanParam, itemsSummary, TEMPLATES, bodyParamCount, buttonTakesParam, whatsappMessageFor, type TemplateKind } from "../src/whatsapp";
import {
  call,
  count,
  deliverWhatsAppStatuses,
  OWNER_WHATSAPP,
  PANEL,
  placedOrder,
  runCron,
  staffCall,
  staffCookie,
  whatsappWebhook,
  WHATSAPP_ENV,
  WHATSAPP_VERIFY_TOKEN,
  world,
  WORKER_ORIGIN,
  type World,
} from "./helpers";

/**
 * WhatsApp Cloud API as the restaurant's alert channel (unit + provider-failure tests against
 * the fake Cloud API). The panel stays the source of truth: whatever WhatsApp does, the order
 * is on the panel and can be handled there.
 */

const alertRows = (w: World, orderId: string) =>
  w.env.DB.raw.prepare("SELECT * FROM notifications WHERE order_id = ? AND channel = 'whatsapp' AND kind = 'new_order'").all(orderId) as Record<string, string | number | null>[];

async function boardCard(w: World, orderId: string) {
  const cookie = await staffCookie(w.env, "Móvil", w.now());
  const board = (await (await staffCall(w, cookie, "/api/admin/board")).json()) as {
    columns: Record<string, { id: string; alert: string }[]>;
    health: { whatsapp: { configured: boolean; lastDeliveredAt: string | null; problem: { kind: string; error: string } | null; failedLast24h: number } };
  };
  const card = Object.values(board.columns).flat().find((c) => c.id === orderId);
  return { card, health: board.health };
}

describe("new-order alert by WhatsApp", () => {
  it("goes to the owner's WhatsApp: number, total, dishes, pickup, payment and a button that opens the panel — no personal data", async () => {
    const w = world(WHATSAPP_ENV);
    const order = await placedOrder(w);
    const [message] = w.whatsapp.messages();
    expect(w.whatsapp.messages()).toHaveLength(1);
    expect(message).toMatchObject({ to: OWNER_WHATSAPP, template: "pedido_nuevo", category: "UTILITY", callback: expect.stringMatching(/^n:\d+$/) });
    expect(message.params.map((p: string) => p.replace(/\u00a0/g, " "))).toEqual([
      `#${order.orderNumber}`,
      "SHANG HAI (PRUEBA, no preparar)",
      "46,55 €",
      "2× Combo A (14 piezas), 1× Pollo con Almendras",
      "Recogida en el local",
      "autorizado, se cobra al aceptar",
    ]);
    expect(message.button).toEqual({ text: "Ver pedido", url: `${PANEL}?pedido=${order.orderId}`, copy: null });
    for (const secret of ["Lucía", "García", "612", "lucia@", "Sin cebolla"]) expect(message.text).not.toContain(secret);
    expect(alertRows(w, order.orderId)[0]).toMatchObject({ status: "sent", provider_message_id: message.id, delivered_at: null });
  });

  it("is 'delivered' only when WhatsApp confirms it (status webhook), not when the API accepts it", async () => {
    const w = world(WHATSAPP_ENV);
    const order = await placedOrder(w);
    expect((await boardCard(w, order.orderId)).card?.alert).toBe("sent");
    const responses = await deliverWhatsAppStatuses(w);
    expect(responses.every((r) => r.status === 200)).toBe(true);
    expect(alertRows(w, order.orderId)[0].delivered_at).toBeTruthy();
    const { card, health } = await boardCard(w, order.orderId);
    expect(card?.alert).toBe("delivered");
    expect(health.whatsapp.lastDeliveredAt).toBeTruthy();
  });

  it("repeated, reordered and late status webhooks never undo a receipt", async () => {
    const w = world(WHATSAPP_ENV);
    const order = await placedOrder(w);
    const id = String(alertRows(w, order.orderId)[0].provider_message_id);
    const status = (s: string, extra: Record<string, unknown> = {}) => ({
      object: "whatsapp_business_account",
      entry: [{ changes: [{ field: "messages", value: { statuses: [{ id, status: s, timestamp: String(Math.floor(w.now().getTime() / 1000)), recipient_id: OWNER_WHATSAPP, ...extra }] } }] }],
    });
    await whatsappWebhook(w, status("read")); // read first: delivery is implied
    await whatsappWebhook(w, status("delivered"));
    await whatsappWebhook(w, status("read"));
    await whatsappWebhook(w, status("sent")); // late
    await whatsappWebhook(w, status("failed", { errors: [{ code: 131026, title: "Message undeliverable" }] })); // after delivery: ignored
    expect(alertRows(w, order.orderId)[0]).toMatchObject({ status: "sent", read_at: expect.any(String), delivered_at: expect.any(String), error_code: null });
  });

  it("the acceptance timeout only counts once WhatsApp confirms delivery (an accepted-but-unconfirmed alert does not count)", async () => {
    const w = world({ ...WHATSAPP_ENV, ACCEPTANCE_TIMEOUT_MINUTES: "30" });
    const order = await placedOrder(w);
    w.whatsapp.takeStatusPayloads(); // the receipts never arrive
    w.advance(31 * 60_000);
    await runCron(w);
    expect(w.env.DB.raw.prepare("SELECT status FROM orders WHERE id = ?").get(order.orderId)).toMatchObject({ status: "awaiting_acceptance" });
  });
});

describe("WhatsApp webhook security", () => {
  it("accepts only payloads signed with the app secret", async () => {
    const w = world(WHATSAPP_ENV);
    const payload = { object: "whatsapp_business_account", entry: [] };
    expect((await whatsappWebhook(w, payload)).status).toBe(200);
    expect((await whatsappWebhook(w, payload, "sha256=" + "0".repeat(64))).status).toBe(401);
    expect((await whatsappWebhook(w, payload, null)).status).toBe(401);
    const unconfigured = world({ ...WHATSAPP_ENV, WHATSAPP_APP_SECRET: "" });
    expect((await whatsappWebhook(unconfigured, payload)).status).toBe(503); // Meta retries for 7 days
  });

  it("answers Meta's subscription check only with the right verify token", async () => {
    const w = world(WHATSAPP_ENV);
    const get = (q: string) => call(w.env, w.deps, `/api/whatsapp/webhook?${q}`);
    const ok = await get(`hub.mode=subscribe&hub.verify_token=${WHATSAPP_VERIFY_TOKEN}&hub.challenge=1158201444`);
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("1158201444");
    expect((await get("hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1")).status).toBe(403);
    expect((await get(`hub.mode=subscribe&hub.verify_token=${WHATSAPP_VERIFY_TOKEN}&hub.challenge=<script>`)).status).toBe(403);
  });

  it("status updates for messages it did not send are ignored", async () => {
    const w = world(WHATSAPP_ENV);
    const res = await whatsappWebhook(w, { entry: [{ changes: [{ value: { statuses: [{ id: "wamid.other", status: "delivered" }] } }] }] });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ applied: 0 });
  });
});

describe("WhatsApp failures: the order is always on the panel, the alert is retried as the error requires", () => {
  it("expired access token (190): retried every 30 min, the panel says so, delivered once the token is renewed", async () => {
    const w = world({ ...WHATSAPP_ENV, ACCEPTANCE_TIMEOUT_MINUTES: "0" });
    w.whatsapp.expireToken();
    const order = await placedOrder(w);
    expect(alertRows(w, order.orderId)[0]).toMatchObject({ status: "failed", error_code: "190" });
    const { card, health } = await boardCard(w, order.orderId);
    expect(card).toBeTruthy(); // visible and manageable
    expect(health.whatsapp.problem).toMatchObject({ kind: "credentials" });
    w.whatsapp.expireToken(false);
    w.advance(10 * 60_000);
    await runCron(w);
    expect(alertRows(w, order.orderId)[0].status).toBe("failed"); // not yet: next attempt in 30 min
    w.advance(21 * 60_000);
    await runCron(w);
    expect(alertRows(w, order.orderId)[0].status).toBe("sent");
    await deliverWhatsAppStatuses(w);
    expect((await boardCard(w, order.orderId)).health.whatsapp.problem).toBeNull(); // a later delivery proves it fixed
  });

  it("template not approved yet (132001): visible as a template problem, sent once approved", async () => {
    const w = world({ ...WHATSAPP_ENV, ACCEPTANCE_TIMEOUT_MINUTES: "0" });
    w.whatsapp.setTemplateStatus("pedido_nuevo", "PENDING");
    const order = await placedOrder(w);
    expect(alertRows(w, order.orderId)[0]).toMatchObject({ status: "failed", error_code: "132001" });
    expect((await boardCard(w, order.orderId)).health.whatsapp.problem).toMatchObject({ kind: "template" });
    w.whatsapp.setTemplateStatus("pedido_nuevo", "APPROVED");
    w.advance(31 * 60_000);
    await runCron(w);
    expect(alertRows(w, order.orderId)[0].status).toBe("sent");
  });

  it("throughput limit (130429) and Meta outages (5xx, 131000) are retried with backoff", async () => {
    for (const failure of [{ status: 429, code: 130429 }, { status: 500, code: 131000 }, { status: 503, code: 2 }]) {
      const w = world(WHATSAPP_ENV);
      w.whatsapp.failNext(failure);
      const order = await placedOrder(w);
      expect(alertRows(w, order.orderId)[0]).toMatchObject({ status: "failed", error_code: String(failure.code) });
      w.advance(2 * 60_000);
      await runCron(w);
      expect(alertRows(w, order.orderId)[0].status, JSON.stringify(failure)).toBe("sent");
    }
  });

  it("a number that cannot receive WhatsApp (131026, reported by webhook) fails for good and is shown as failed", async () => {
    const w = world(WHATSAPP_ENV);
    w.whatsapp.failNext({ deliveryFailure: 131026, title: "Message undeliverable" });
    const order = await placedOrder(w);
    await deliverWhatsAppStatuses(w);
    expect(alertRows(w, order.orderId)[0]).toMatchObject({ status: "failed", error_code: "131026", next_attempt_at: null });
    w.advance(60 * 60_000);
    await runCron(w);
    expect(w.whatsapp.messages().filter((m) => m.template === "pedido_nuevo")).toHaveLength(1); // never retried
    expect((await boardCard(w, order.orderId)).card?.alert).toBe("failed");
  });

  it("a recipient outside the test number's allowed list (131030) is a configuration problem the panel shows", async () => {
    const w = world(WHATSAPP_ENV);
    w.whatsapp.state.allowedRecipients = ["34600999999"];
    await placedOrder(w);
    const { health } = await boardCard(w, "x");
    expect(health.whatsapp.problem).toMatchObject({ kind: "configuration" });
    expect(health.whatsapp.problem?.error).toMatch(/allowed list/);
  });

  it("the owner's own business number as recipient (131021) is refused, not looped", async () => {
    const w = world({ ...WHATSAPP_ENV, WHATSAPP_RECIPIENTS: "+15550001111" });
    const order = await placedOrder(w);
    expect(alertRows(w, order.orderId)[0]).toMatchObject({ status: "failed", error_code: "131021" });
  });

  it("no answer from WhatsApp, but the message went out: the status webhook reconciles it — no duplicate", async () => {
    const w = world(WHATSAPP_ENV);
    w.whatsapp.failNext({ network: true, afterExecute: true });
    const order = await placedOrder(w);
    expect(alertRows(w, order.orderId)[0]).toMatchObject({ status: "failed", provider_message_id: null });
    await deliverWhatsAppStatuses(w); // carries biz_opaque_callback_data = n:<row>
    expect(alertRows(w, order.orderId)[0]).toMatchObject({ status: "sent", delivered_at: expect.any(String) });
    w.advance(10 * 60_000);
    await runCron(w);
    expect(w.whatsapp.messages().filter((m) => m.template === "pedido_nuevo")).toHaveLength(1);
  });

  it("no answer and no webhook: retried after a pause (the restaurant is never left without the alert)", async () => {
    const w = world(WHATSAPP_ENV);
    w.whatsapp.failNext({ network: true });
    const order = await placedOrder(w);
    w.advance(30_000);
    await runCron(w);
    expect(w.whatsapp.messages()).toHaveLength(0); // not immediately
    w.advance(70_000);
    await runCron(w);
    expect(w.whatsapp.messages()).toHaveLength(1);
    expect(alertRows(w, order.orderId)[0].status).toBe("sent");
  });

  it("two orders in a row to the same owner: the second alert waits for its turn (6 s) and goes out, no 131056", async () => {
    const w = world(WHATSAPP_ENV);
    w.whatsapp.state.pairIntervalMs = 6_000;
    const first = await placedOrder(w);
    const second = await placedOrder(w);
    expect(alertRows(w, first.orderId)[0]).toMatchObject({ status: "sent", error_code: null });
    expect(alertRows(w, second.orderId)[0]).toMatchObject({ status: "sent", error_code: null });
    const [a, b] = w.whatsapp.messages().filter((m) => m.template === "pedido_nuevo");
    expect(Date.parse(b.at) - Date.parse(a.at)).toBeGreaterThanOrEqual(6_000);
  });

  it("the 6 s count from Meta's answer: a slow request followed by a fast one still arrives 6 s apart (no 131056)", async () => {
    const w = world(WHATSAPP_ENV);
    w.whatsapp.state.pairIntervalMs = 6_000; // like Meta: measured between arrivals
    const direct = w.deps.fetch;
    let slow = true;
    w.deps.fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (slow && url.includes("graph.facebook.com")) {
        slow = false;
        w.advance(3_000); // the first alert takes 3 s to reach Meta
      }
      return direct(input, init);
    };
    await placedOrder(w);
    const second = await placedOrder(w);
    expect(alertRows(w, second.orderId)[0]).toMatchObject({ status: "sent", error_code: null });
    const [a, b] = w.whatsapp.messages().filter((m) => m.template === "pedido_nuevo");
    expect(Date.parse(b.at) - Date.parse(a.at)).toBeGreaterThanOrEqual(6_000);
  });

  it("simultaneous deliveries to the same owner take turns atomically (no 131056 when many orders arrive at once)", async () => {
    const w = world(WHATSAPP_ENV);
    w.whatsapp.state.pairIntervalMs = 6_000;
    // Two orders paid while their alerts cannot go out yet, then two delivery runs at the same time.
    w.whatsapp.failNext({ status: 503, code: 2, times: 2 });
    const a = await placedOrder(w);
    const b = await placedOrder(w);
    w.advance(20_000);
    const { deliverDue } = await import("../src/notifications");
    await Promise.all([deliverDue(w.env, w.deps), deliverDue(w.env, w.deps)]);
    const rows = [alertRows(w, a.orderId)[0], alertRows(w, b.orderId)[0]];
    // Neither run may wait here: one alert goes now, the other is rescheduled for its turn.
    expect(rows.map((r) => r.status).sort()).toEqual(["pending", "sent"]);
    expect(rows.some((r) => r.error_code === "131056")).toBe(false);
    const waiting = rows.find((r) => r.status === "pending")!;
    expect(Date.parse(String(waiting.next_attempt_at)) - w.now().getTime()).toBe(6_000);
    expect(w.whatsapp.messages().filter((m) => m.template === "pedido_nuevo")).toHaveLength(1);
  });

  it("a burst of orders: alerts reach the owner one every 6 s; what does not fit in the run goes out with the cron, none fails", async () => {
    const w = world(WHATSAPP_ENV);
    w.whatsapp.state.pairIntervalMs = 6_000;
    w.whatsapp.failNext({ status: 503, code: 2, times: 9 });
    const orders = [];
    for (let i = 0; i < 9; i += 1) orders.push(await placedOrder(w));
    w.advance(20_000);
    await runCron(w); // waits up to 40 s for turns: about 7 alerts, the rest rescheduled
    const firstRun = w.whatsapp.messages().filter((m) => m.template === "pedido_nuevo").length;
    expect(firstRun).toBeGreaterThanOrEqual(6);
    expect(firstRun).toBeLessThan(9);
    w.advance(60_000);
    await runCron(w);
    const sent = w.whatsapp.messages().filter((m) => m.template === "pedido_nuevo");
    expect(sent).toHaveLength(9);
    for (let i = 1; i < sent.length; i += 1) expect(Date.parse(sent[i].at) - Date.parse(sent[i - 1].at)).toBeGreaterThanOrEqual(6_000);
    for (const o of orders) expect(alertRows(w, o.orderId)[0]).toMatchObject({ status: "sent", error_code: null });
  });

  it("an alert that waited for its turn is not sent if the order was dealt with meanwhile", async () => {
    const w = world(WHATSAPP_ENV);
    w.whatsapp.state.pairIntervalMs = 6_000;
    w.whatsapp.failNext({ status: 503, code: 2 });
    const order = await placedOrder(w); // its alert could not go out: retried later
    w.advance(60_000);
    const { deliverDue, recordWhatsAppSend } = await import("../src/notifications");
    await recordWhatsAppSend(w.env, OWNER_WHATSAPP, w.now().toISOString()); // a message just went to the owner
    const wait = w.deps.sleep;
    let waited = 0;
    w.deps.sleep = async (ms) => {
      waited += 1; // while the alert waits for the owner's turn, staff reject the order in the panel
      w.env.DB.raw.prepare("UPDATE orders SET status = 'rejected' WHERE id = ?").run(order.orderId);
      await wait(ms);
    };
    await deliverDue(w.env, w.deps, { paceBudgetMs: 20_000 });
    expect(waited).toBe(1);
    expect(alertRows(w, order.orderId)[0].status).toBe("skipped");
    expect(w.whatsapp.messages().filter((m) => m.template === "pedido_nuevo")).toHaveLength(0);
  });

  it("a sign-in code just sent to the same number also counts for the pair rate limit (the alert waits its turn, it does not fail)", async () => {
    const w = world(WHATSAPP_ENV);
    w.whatsapp.state.pairIntervalMs = 6_000;
    const asked = await call(w.env, w.deps, "/api/admin/auth/code", { method: "POST", headers: { "Content-Type": "application/json", Origin: WORKER_ORIGIN }, body: "{}" });
    expect(asked.status).toBe(202);
    const order = await placedOrder(w);
    expect(alertRows(w, order.orderId)[0]).toMatchObject({ status: "sent", error_code: null });
    const code = w.whatsapp.messages().find((m) => m.template === "codigo_acceso")!;
    const alert = w.whatsapp.messages().find((m) => m.template === "pedido_nuevo")!;
    expect(Date.parse(alert.at) - Date.parse(code.at)).toBeGreaterThanOrEqual(6_000);
  });

  it("an alert just sent: the sign-in code waits a few seconds for its turn and arrives (no 131056)", async () => {
    const w = world(WHATSAPP_ENV);
    w.whatsapp.state.pairIntervalMs = 6_000;
    await placedOrder(w);
    const asked = await call(w.env, w.deps, "/api/admin/auth/code", { method: "POST", headers: { "Content-Type": "application/json", Origin: WORKER_ORIGIN }, body: "{}" });
    expect(asked.status).toBe(202);
    const alert = w.whatsapp.messages().find((m) => m.template === "pedido_nuevo")!;
    const code = w.whatsapp.messages().find((m) => m.template === "codigo_acceso")!;
    expect(Date.parse(code.at) - Date.parse(alert.at)).toBeGreaterThanOrEqual(6_000);
  });

  it("if Meta still answers 131056, the retry follows its advice (wait, then grow)", async () => {
    const w = world(WHATSAPP_ENV);
    w.whatsapp.failNext({ status: 429, code: 131056 });
    const order = await placedOrder(w);
    const row = alertRows(w, order.orderId)[0];
    expect(row.error_code).toBe("131056");
    expect(Date.parse(String(row.next_attempt_at)) - w.now().getTime()).toBe(6_000);
  });

  it("a number removed from WHATSAPP_RECIPIENTS gets no more retries", async () => {
    const w = world(WHATSAPP_ENV);
    w.whatsapp.failNext({ status: 500, code: 131000 });
    const order = await placedOrder(w);
    w.env.WHATSAPP_RECIPIENTS = "+34699000000";
    w.advance(5 * 60_000);
    await runCron(w);
    expect(alertRows(w, order.orderId).find((r) => r.recipient === OWNER_WHATSAPP)).toMatchObject({ status: "skipped" });
    expect(w.whatsapp.messages().filter((m) => m.to === OWNER_WHATSAPP)).toHaveLength(0);
  });

  it("with Telegram also configured, a WhatsApp outage does not stop the Telegram alert", async () => {
    const w = world({ ...WHATSAPP_ENV, TELEGRAM_BOT_TOKEN: "123456789:AAFakeTokenForUnitTestsOnly_abcdef", TELEGRAM_CHAT_IDS: "111111111" });
    w.whatsapp.expireToken();
    await placedOrder(w);
    expect(w.telegram.messages().filter((m) => m.text.includes("NUEVO PEDIDO"))).toHaveLength(1);
    expect(count(w.env, "SELECT COUNT(*) AS n FROM notifications WHERE channel = 'whatsapp' AND status = 'failed'")).toBe(1);
  });
});

describe("staff sign-in code by WhatsApp", () => {
  const post = (w: World, path: string, body: unknown) =>
    call(w.env, w.deps, path, { method: "POST", headers: { "Content-Type": "application/json", Origin: WORKER_ORIGIN }, body: JSON.stringify(body) });

  it("arrives as the approved authentication template (copy-code button), only to the authorised number, and opens the panel", async () => {
    const w = world(WHATSAPP_ENV);
    const asked = await post(w, "/api/admin/auth/code", {});
    expect(asked.status).toBe(202);
    expect(await asked.json()).toMatchObject({ channels: ["whatsapp"] });
    const [message] = w.whatsapp.messages();
    expect(message).toMatchObject({ to: OWNER_WHATSAPP, template: "codigo_acceso", category: "AUTHENTICATION" });
    const code = message.params[0];
    expect(code).toMatch(/^\d{6}$/);
    expect(message.button).toMatchObject({ copy: code });
    const verified = await post(w, "/api/admin/auth/verify", { code, label: "Móvil del dueño" });
    expect(verified.status).toBe(200);
    const cookie = /(__Host-shp_session=[^;]+)/.exec(verified.headers.get("set-cookie") ?? "")?.[1] ?? "";
    const session = await staffCall(w, cookie, "/api/admin/session");
    expect(await session.json()).toMatchObject({ authenticated: true, method: "code", loginMethods: ["whatsapp"] });
  });

  it("says so when WhatsApp cannot deliver the code (expired token): 502, no session", async () => {
    const w = world(WHATSAPP_ENV);
    w.whatsapp.expireToken();
    expect((await post(w, "/api/admin/auth/code", {})).status).toBe(502);
  });
});

describe("templates follow Meta's rules", () => {
  const kinds: TemplateKind[] = ["new_order", "reminder", "needs_review", "auto_cancelled", "login_code"];

  it("one template per alert kind, with the parameters the Worker sends", () => {
    for (const kind of kinds) expect(TEMPLATES.some((t) => t.kind === kind), kind).toBe(true);
    const order = { id: "SH-261106-AB12CD", number: 1042, total_cents: 3880, fulfillment: "pickup", payment_status: "authorized", payments_mode: "stripe-live", review_reason: "La devolución ha fallado" };
    for (const kind of ["new_order", "reminder", "needs_review", "auto_cancelled"] as const) {
      const message = whatsappMessageFor(kind, order, [{ quantity: 1, name: "Combo A" }], { restaurant: "SHANG HAI", autoCancelText: "x" });
      const def = TEMPLATES.find((t) => t.name === message.template)!;
      expect(message.body, kind).toHaveLength(bodyParamCount(def));
      expect(Boolean(message.buttonSuffix), kind).toBe(buttonTakesParam(def));
    }
  });

  it("utility bodies ≤ 1024 characters, buttons ≤ 25 characters, URL variable at the end, and the panel is the only link", () => {
    for (const t of TEMPLATES.filter((x) => x.category === "UTILITY")) {
      const body = t.components.find((c) => c.type === "BODY")!.text!;
      expect(body.length, t.name).toBeLessThanOrEqual(1024);
      expect(body.trim().startsWith("{{"), t.name).toBe(false);
      for (const b of t.components.find((c) => c.type === "BUTTONS")?.buttons ?? []) {
        expect(b.url, t.name).toMatch(/^\{\{PANEL_URL\}\}\?pedido=\{\{1\}\}$/);
      }
    }
  });

  it("the authentication template has no custom text, URL or emoji (Meta's rule)", () => {
    const auth = TEMPLATES.find((t) => t.category === "AUTHENTICATION")!;
    expect(auth.components.find((c) => c.type === "BODY")?.text).toBeUndefined();
    expect(JSON.stringify(auth)).not.toMatch(/https?:|\{\{PANEL_URL\}\}/);
  });

  it("parameter values are made acceptable (one line, no tabs, no long runs of spaces, never empty, bounded)", () => {
    expect(cleanParam("Sin\ncebolla\t\tpor     favor")).toBe("Sin cebolla por favor");
    expect(cleanParam("   ")).toBe("—");
    expect(cleanParam("x".repeat(500), 50)).toHaveLength(50);
    const many = Array.from({ length: 40 }, (_, i) => ({ quantity: 1, name: `Plato número ${i}` }));
    const summary = itemsSummary(many);
    expect(summary.length).toBeLessThanOrEqual(250);
    expect(summary).toMatch(/ y \d+ más$/);
  });
});
