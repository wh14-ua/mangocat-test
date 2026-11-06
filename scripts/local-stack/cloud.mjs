#!/usr/bin/env node
// Local "cloud" for the end-to-end demo: a fake Stripe (API + hosted payment page + signed
// webhooks to the Worker) and a fake Telegram (Bot API + a "staff phone" page), plus control
// endpoints the E2E tests use to inject failures. Test data only — no real money, no cards.
//
//   PORT=8790 WEBHOOK_URL=http://localhost:8787/api/stripe/webhook WEBHOOK_SECRET=whsec_local \
//   node scripts/local-stack/cloud.mjs
//
// With STATE_DIR set (the local demo), Stripe and Telegram state is persisted there, next to
// the local D1, so restarting keeps everything consistent. Undelivered webhooks are kept and
// retried (Stripe retries for days), also across restarts.
import { createServer } from "node:http";
import { join } from "node:path";
import { createFakeStripe, signPayload } from "./fake-stripe.mjs";
import { createFakeTelegram } from "./fake-telegram.mjs";

const PORT = Number(process.env.PORT ?? 8790);
const HOST = process.env.HOST ?? "localhost";
const ORIGIN = `http://${HOST}:${PORT}`;
const WEBHOOK_URL = process.env.WEBHOOK_URL ?? "http://localhost:8787/api/stripe/webhook";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "whsec_local_demo_secret";
const STATE_DIR = process.env.STATE_DIR || "";

const stripe = createFakeStripe({ hostedBase: `${ORIGIN}/pay`, persistPath: STATE_DIR ? join(STATE_DIR, "fake-stripe.json") : undefined });
const telegram = createFakeTelegram({ persistPath: STATE_DIR ? join(STATE_DIR, "fake-telegram.json") : undefined });
const webhookLog = [];

// Webhook chaos controls (tests): pause delivery (late / never), duplicate, reverse order.
const webhooks = { paused: false, duplicate: false, reverse: false };
/** Response delays: { method, path: RegExp, delayMs, after: boolean, times } — `after` = Stripe did the work, the answer is slow. */
const delays = [];
let delivering = false;

async function post(event) {
  const body = JSON.stringify(event);
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Stripe-Signature": signPayload(body, WEBHOOK_SECRET) },
      body,
      signal: AbortSignal.timeout(20_000),
    });
    return res.status;
  } catch {
    return 0;
  }
}

/** Delivers queued Stripe events to the Worker, signed. Failed ones stay queued and are retried. */
async function deliverEvents() {
  if (webhooks.paused || delivering) return;
  delivering = true;
  try {
    let batch = stripe.takeEvents();
    if (webhooks.reverse) batch = batch.reverse();
    const failed = [];
    for (const event of batch) {
      const copies = webhooks.duplicate ? 2 : 1;
      let status = 0;
      for (let i = 0; i < copies; i++) status = await post(event);
      webhookLog.push({ id: event.id, type: event.type, status, at: new Date().toISOString() });
      if (!(status >= 200 && status < 300)) failed.push(event);
    }
    if (failed.length) stripe.requeueEvents(failed);
  } finally {
    delivering = false;
  }
}
// Retry loop for anything that could not be delivered (Worker down, restarting, 5xx).
setInterval(() => void deliverEvents(), 2_000).unref();

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const euro = (cents) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(cents / 100);

function page(title, body, refresh = false) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${
    refresh ? '<meta http-equiv="refresh" content="3">' : ""
  }<title>${escape(title)}</title><style>
  body{margin:0;font:16px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#eef1f5;color:#1a1f36}
  main{max-width:460px;margin:0 auto;padding:24px 16px}
  .card{background:#fff;border-radius:12px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,.08),0 8px 24px -12px rgba(0,0,0,.2)}
  .warn{background:#fff6d6;border:1px solid #d9a300;color:#5c4300;border-radius:8px;padding:10px 12px;font-weight:600;margin-bottom:14px}
  button,a.btn{display:block;width:100%;box-sizing:border-box;min-height:48px;margin-top:10px;border:0;border-radius:8px;font:600 16px system-ui;cursor:pointer;text-align:center;line-height:48px;text-decoration:none}
  .pay{background:#635bff;color:#fff}.decline{background:#fff;color:#b42318;border:1px solid #d0d5dd}.cancel{background:transparent;color:#344054;text-decoration:underline}
  table{width:100%;border-collapse:collapse;margin:12px 0}td{padding:6px 0;border-bottom:1px solid #eef0f3}td.n{text-align:right}
  .total td{font-weight:700;border:0}.msg{background:#fff;border-radius:12px;padding:12px 14px;margin:10px 0;box-shadow:0 1px 2px rgba(0,0,0,.08);white-space:pre-wrap}
  .meta{font-size:12px;color:#667085}.err{color:#b42318;font-weight:600}
  </style></head><body><main>${body}</main></body></html>`;
}

function checkoutPage(session, error = "") {
  const form = session._form;
  const lines = Object.values(form.line_items ?? {});
  const english = String(session.locale ?? "").startsWith("en");
  const t = english
    ? { notice: "Local test payment — no real money", pay: "Authorise payment (test card 4242)", decline: "Use a card that is declined", cancel: "Cancel and go back", total: "Total", hold: "The amount is only put on hold; it is charged when the restaurant accepts." }
    : { notice: "Pago de prueba local — sin dinero real", pay: "Autorizar pago (tarjeta de prueba 4242)", decline: "Usar una tarjeta rechazada", cancel: "Cancelar y volver", total: "Total", hold: "El importe solo se reserva; se cobra cuando el restaurante acepta." };
  const rows = lines
    .map((l) => `<tr><td>${escape(l.quantity)} × ${escape(l.price_data.product_data.name)}</td><td class="n">${euro(Number(l.price_data.unit_amount) * Number(l.quantity))}</td></tr>`)
    .join("");
  return page(
    "Stripe Checkout (simulado)",
    `<div class="warn" role="note">${t.notice}</div><div class="card"><p class="meta">SHANG HAI · ${escape(session.client_reference_id ?? "")}</p>
     <table>${rows}<tr class="total"><td>${t.total}</td><td class="n">${euro(session.amount_total)}</td></tr></table>
     <p class="meta">${t.hold}</p>${error ? `<p class="err" role="alert">${escape(error)}</p>` : ""}
     <form method="post" action="/pay/${escape(session.id)}/authorize"><button class="pay" data-testid="fake-stripe-pay">${t.pay}</button></form>
     <form method="post" action="/pay/${escape(session.id)}/decline"><button class="decline" data-testid="fake-stripe-decline">${t.decline}</button></form>
     <form method="post" action="/pay/${escape(session.id)}/cancel"><button class="cancel" data-testid="fake-stripe-cancel">${t.cancel}</button></form></div>`,
  );
}

function phonePage() {
  const messages = [...telegram.messages()].reverse();
  const items = messages
    .map(
      (m) =>
        `<div class="msg" data-testid="telegram-message"><div class="meta">chat ${escape(m.chat_id)} · ${escape(m.at.slice(11, 19))}</div>${escape(
          m.text.replace(/<[^>]+>/g, ""),
        )}${m.button ? `<a class="btn pay" href="${escape(m.button.url)}" target="_blank" rel="noopener">${escape(m.button.text)}</a>` : ""}</div>`,
    )
    .join("");
  return page("Telegram (simulado)", `<h1>📱 Telegram del restaurante (simulado)</h1><p class="meta">Se actualiza cada 3 s.</p>${items || "<p>Sin mensajes todavía.</p>"}`, true);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "Content-Type": `${type}; charset=utf-8`, "Cache-Control": "no-store" });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", ORIGIN);
  const path = url.pathname;
  try {
    // --- Stripe API ---------------------------------------------------------
    if (path.startsWith("/v1/")) {
      const raw = req.method === "POST" ? await readBody(req) : "";
      const params = req.method === "POST" ? new URLSearchParams(raw) : url.searchParams;
      const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), String(v)]));
      const delayIndex = delays.findIndex((d) => d.method === req.method && d.path.test(path));
      const delay = delayIndex === -1 ? null : delays[delayIndex];
      if (delay && --delay.times <= 0) delays.splice(delayIndex, 1);
      if (delay && !delay.after) await new Promise((r) => setTimeout(r, delay.delayMs)); // slow before reaching Stripe
      const result = stripe.handle(req.method ?? "GET", path, params, headers);
      if (delay?.after) await new Promise((r) => setTimeout(r, delay.delayMs)); // done at Stripe, answer slow
      if (result.network) {
        req.socket.destroy(); // like a dropped connection
        void deliverEvents();
        return;
      }
      if (!res.destroyed && !req.socket.destroyed) send(res, result.status, result.body);
      void deliverEvents();
      return;
    }

    // --- Hosted payment page --------------------------------------------------
    let m = /^\/pay\/(cs_test_[A-Za-z0-9]+)(?:\/(authorize|decline|cancel))?$/.exec(path);
    if (m) {
      const session = stripe.session(m[1]);
      if (!session) return send(res, 404, page("Sesión no encontrada", "<p>Sesión de pago no encontrada.</p>"), "text/html");
      if (!m[2]) return send(res, 200, checkoutPage(session), "text/html");
      if (m[2] === "cancel") {
        res.writeHead(303, { Location: session.cancel_url });
        return res.end();
      }
      stripe.completeSession(session.id, m[2] === "authorize" ? "authorize" : "decline");
      await deliverEvents();
      if (m[2] === "decline") {
        const error = String(session.locale ?? "").startsWith("en") ? "Your card was declined. Try another card." : "Tarjeta rechazada. Prueba con otra tarjeta.";
        return send(res, 402, checkoutPage(session, error), "text/html");
      }
      res.writeHead(303, { Location: session.success_url.replace("{CHECKOUT_SESSION_ID}", session.id) });
      return res.end();
    }

    // --- Telegram Bot API and the staff phone ---------------------------------
    if (/^\/bot[^/]+\/sendMessage$/.test(path) && req.method === "POST") {
      const result = telegram.handle(path, JSON.parse((await readBody(req)) || "{}"));
      if (result.network) return req.socket.destroy();
      return send(res, result.status, result.body);
    }
    if (path === "/telegram") return send(res, 200, phonePage(), "text/html");

    // --- Control (tests) --------------------------------------------------------
    if (path === "/__control/state") {
      return send(res, 200, {
        persisted: Boolean(STATE_DIR),
        sessions: stripe.state.sessions.size,
        sessionIds: [...stripe.state.sessions.keys()],
        intents: [...stripe.state.intents.values()].map((pi) => ({
          id: pi.id,
          status: pi.status,
          order: pi.metadata?.order_id,
          amount: pi.amount,
          amountReceived: pi.amount_received,
          amountCapturable: pi.amount_capturable,
        })),
        charges: [...stripe.state.charges.values()].map((c) => ({ id: c.id, pi: c.payment_intent, captured: c.captured, amountCaptured: c.amount_captured, amountRefunded: c.amount_refunded })),
        refunds: [...stripe.state.refunds.values()].map((r) => ({ id: r.id, status: r.status, amount: r.amount, pi: r.payment_intent })),
        calls: stripe.state.calls.slice(-200).map((c) => ({ method: c.method, path: c.path, key: c.headers["idempotency-key"] ?? null })),
        queuedWebhooks: stripe.state.events.length,
        webhooks: webhookLog.slice(-100),
        telegram: telegram.messages(),
      });
    }
    if (path === "/__control/webhooks" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      for (const k of ["paused", "duplicate", "reverse"]) if (typeof body[k] === "boolean") webhooks[k] = body[k];
      if (body.drop) stripe.takeEvents(); // "the webhook never arrives"
      if (!webhooks.paused) await deliverEvents();
      return send(res, 200, { ok: true, ...webhooks, queued: stripe.state.events.length });
    }
    if (path === "/__control/stripe/delay" && req.method === "POST") {
      const d = JSON.parse(await readBody(req));
      delays.push({ times: 1, after: false, ...d, path: new RegExp(d.path) });
      return send(res, 200, { ok: true });
    }
    if (path === "/__control/stripe/clear-failures" && req.method === "POST") {
      stripe.clearFailures();
      delays.length = 0;
      return send(res, 200, { ok: true });
    }
    if ((m = /^\/__control\/stripe\/settle-refund\/(re_test_[A-Za-z0-9]+)$/.exec(path)) && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      stripe.settleRefund(m[1], body.status ?? "succeeded");
      await deliverEvents();
      return send(res, 200, { ok: true });
    }
    if (path === "/__control/stripe/fail" && req.method === "POST") {
      const f = JSON.parse(await readBody(req));
      stripe.failNext({ ...f, path: new RegExp(f.path) });
      return send(res, 200, { ok: true });
    }
    if (path === "/__control/stripe/refund-outcome" && req.method === "POST") {
      stripe.setRefundOutcome(JSON.parse(await readBody(req)).outcome);
      return send(res, 200, { ok: true });
    }
    if ((m = /^\/__control\/stripe\/expire-authorization\/(pi_test_[A-Za-z0-9]+)$/.exec(path)) && req.method === "POST") {
      stripe.expireAuthorization(m[1]);
      await deliverEvents();
      return send(res, 200, { ok: true });
    }
    if (path === "/__control/telegram/fail" && req.method === "POST") {
      telegram.failNext(JSON.parse(await readBody(req)));
      return send(res, 200, { ok: true });
    }
    if (path === "/") {
      return send(res, 200, page("Nube local", `<h1>Nube local de pruebas</h1><p><a href="/telegram">Telegram del restaurante (simulado)</a></p>`), "text/html");
    }
    send(res, 404, { error: "not-found" });
  } catch (error) {
    send(res, 500, { error: error instanceof Error ? error.message : "server" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(
    `Local cloud on ${ORIGIN}  (Stripe API ${ORIGIN}/v1, staff phone ${ORIGIN}/telegram)${STATE_DIR ? ` — state kept in ${STATE_DIR}` : " — in memory"}`,
  );
  void deliverEvents(); // events queued before a restart
});
