#!/usr/bin/env node
/**
 * Dev harness for the staff panel: serves the real panelHtml(nonce) + panelAsset(path)
 * (panel/server.ts bundled for Node with esbuild, using the committed generated assets)
 * under the Worker's exact CSP, plus an in-memory MOCK of the staff API with realistic
 * orders. No Stripe, no Telegram, no database.
 *
 *   node panel/dev/serve-mock.mjs [--port 8790]        then open http://127.0.0.1:8790/admin
 *
 * Scenario controls (for screenshots and manual checks):
 *   POST /__mock/reset?scenario=board|empty|signin|access|closed
 *   POST /__mock/new-order                 adds a new order to NUEVOS
 * Sign-in scenario: any "ENVIAR CÓDIGO" works; the code is 123456.
 * Accepting or rejecting order #1048 answers 409 (another phone handled it first).
 */
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const PANEL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

/** Same policy as src/index.ts panelPage(). */
function csp(nonce) {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    `style-src 'nonce-${nonce}'`,
    "connect-src 'self'",
    "img-src 'self' data:",
    "manifest-src 'self'",
    "worker-src 'self'",
    "media-src 'self' data:",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

async function loadPanelServer() {
  const out = await esbuild.build({
    entryPoints: [join(PANEL_DIR, "server.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node20",
    write: false,
    logLevel: "silent",
  });
  const dir = mkdtempSync(join(tmpdir(), "shp-panel-"));
  const file = join(dir, "server.mjs");
  writeFileSync(file, out.outputFiles[0].text);
  try {
    return await import(pathToFileURL(file).href);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MIN = 60_000;
const iso = (ms) => new Date(ms).toISOString();
const STATUS_LABEL = {
  awaiting_acceptance: "Pendiente de aceptación",
  accepting: "Pendiente de aceptación",
  rejecting: "Pedido rechazado",
  preparing: "En preparación",
  ready: "Listo para recoger",
  completed: "Entregado",
  rejected: "Pedido rechazado",
  cancelled: "Pedido cancelado",
  needs_review: "En revisión",
};
const COLUMN = {
  awaiting_acceptance: "new",
  accepting: "new",
  rejecting: "new",
  needs_review: "new",
  preparing: "preparing",
  ready: "ready",
  completed: "completed",
  rejected: "rejected",
  cancelled: "rejected",
};

function idFor(number) {
  return `SH-261105-${String(number).padStart(4, "0")}AB`.slice(0, 17);
}

function makeOrder(now, spec) {
  const createdAt = now - spec.ageMin * MIN;
  const lines = spec.lines.map(([quantity, name, unitCents, options]) => ({ quantity, name, options: options ?? null, lineTotalCents: quantity * unitCents }));
  const total = lines.reduce((n, l) => n + l.lineTotalCents, 0);
  return {
    id: idFor(spec.number),
    number: spec.number,
    status: spec.status,
    paymentStatus: spec.payment,
    createdAt: iso(createdAt),
    updatedAt: iso(now - (spec.updatedMin ?? spec.ageMin) * MIN),
    authorizedAt: iso(createdAt + 0.5 * MIN),
    acceptedAt: spec.acceptedMin !== undefined ? iso(now - spec.acceptedMin * MIN) : null,
    prepMinutes: spec.prep ?? null,
    readyBy: spec.acceptedMin !== undefined && spec.prep ? iso(now - spec.acceptedMin * MIN + spec.prep * MIN) : null,
    readyAt: spec.readyMin !== undefined ? iso(now - spec.readyMin * MIN) : null,
    completedAt: spec.completedMin !== undefined ? iso(now - spec.completedMin * MIN) : null,
    rejectedAt: spec.rejectedMin !== undefined ? iso(now - spec.rejectedMin * MIN) : null,
    rejectionReason: spec.reason ?? null,
    reviewReason: spec.review ?? null,
    customer: { name: spec.name, phone: spec.phone, phoneDisplay: displayPhone(spec.phone) },
    email: spec.email,
    notes: spec.notes ?? null,
    fulfillment: "pickup",
    lines,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    totalCents: total,
    ageRestricted: Boolean(spec.age),
    storefront: spec.storefront ?? "ink-house",
    locale: spec.locale ?? "es",
    mode: "stripe-test",
    captureBefore: iso(createdAt + 7 * 24 * 60 * MIN),
    alert: spec.alert ?? "sent",
    stripePaymentIntentId: `pi_3QmockShangHai${spec.number}`,
    events: [],
  };
}

function displayPhone(e164) {
  const es = /^\+34(\d{3})(\d{3})(\d{3})$/.exec(e164);
  return es ? `${es[1]} ${es[2]} ${es[3]}` : e164;
}

function allowedActions(o, now) {
  const placed = o.paymentStatus === "authorized" || o.paymentStatus === "captured";
  switch (o.status) {
    case "awaiting_acceptance":
      return placed ? ["accept", "reject"] : ["reject"];
    case "needs_review":
      return [...(placed ? ["accept"] : []), "reject", "retry"];
    case "accepting":
    case "rejecting":
      return now - Date.parse(o.updatedAt) > 90_000 ? ["retry"] : [];
    case "preparing":
      return ["ready", "reject"];
    case "ready":
      return ["complete", "reject"];
    case "rejected":
      return o.paymentStatus === "refund_pending" ? ["retry"] : [];
    default:
      return [];
  }
}

function card(o, now) {
  const { email: _email, stripePaymentIntentId: _pi, events: _events, ...rest } = o;
  void _email;
  void _pi;
  void _events;
  return {
    ...rest,
    statusLabel: STATUS_LABEL[o.status] ?? o.status,
    column: COLUMN[o.status] ?? null,
    reviewReason: o.status === "needs_review" ? o.reviewReason : null,
    actions: allowedActions(o, now),
  };
}

function seed(now) {
  const specs = [
    { number: 1043, status: "needs_review", payment: "refund_failed", ageMin: 34, updatedMin: 6, name: "Lucía Fernández", phone: "+34655443322", email: "lucia.f@example.com", review: "La devolución ha fallado en Stripe (expired_or_canceled_card). El dinero sigue cobrado: hay que devolverlo", lines: [[1, "Menú para 6 Personas A", 8345, "Con postre"]], alert: "sent" },
    { number: 1046, status: "awaiting_acceptance", payment: "authorized", ageMin: 6, name: "Pedro Martínez", phone: "+34612345678", email: "pedro.m@example.com", notes: "Sin cebolla en el arroz, por favor. Alergia a los cacahuetes.", lines: [[2, "Arroz Frito con Tres Delicias", 450], [1, "Pollo con Salsa de Limón", 765], [1, "Rollito Vietnamita", 300], [2, "Cerveza China", 225]], alert: "sent" },
    { number: 1048, status: "awaiting_acceptance", payment: "authorized", ageMin: 2, name: "Emily Clarke", phone: "+447700900123", email: "emily.clarke@example.co.uk", locale: "en", age: true, lines: [[1, "Pato a la Pekinesa", 1400], [1, "Tallarines con Gambas", 695], [1, "Vino Tinto Marques de Cáceres", 1745]], alert: "pending" },
    { number: 1049, status: "accepting", payment: "authorized", ageMin: 4, updatedMin: 3, name: "Javier Ruiz", phone: "+34699887766", email: "javi.ruiz@example.com", lines: [[3, "Gyozas de Pollo a la Plancha", 645], [1, "Arroz Blanco", 260]], alert: "sent" },
    { number: 1044, status: "preparing", payment: "captured", ageMin: 15, acceptedMin: 12, prep: 20, name: "Carmen López", phone: "+34600112233", email: "carmen.lopez@example.com", notes: "Salsa picante aparte.", lines: [[1, "Ternera con Salsa de Ostras", 865], [1, "Tallarines Estilo Chino", 895], [2, "Pan de Gambas", 300]], alert: "sent" },
    { number: 1045, status: "preparing", payment: "captured", ageMin: 30, acceptedMin: 26, prep: 20, name: "Antonio García", phone: "+34611223344", email: "antonio.g@example.com", lines: [[2, "Gambas con Ajo a la Plancha", 945], [1, "Arroz Frito de la Casa", 645]], alert: "sent" },
    { number: 1042, status: "ready", payment: "captured", ageMin: 41, acceptedMin: 38, prep: 30, readyMin: 4, name: "María Sánchez", phone: "+34622334455", email: "maria.s@example.com", age: true, lines: [[1, "Poke Bowl de Pollo", 1145], [1, "Vino Tinto Marques de Riscal", 2400]], alert: "sent" },
    { number: 1041, status: "completed", payment: "captured", ageMin: 75, acceptedMin: 72, prep: 20, readyMin: 50, completedMin: 22, name: "Raúl Torres", phone: "+34633445566", email: "raul.t@example.com", lines: [[1, "Pollo con Almendras", 765], [1, "Arroz Frito con Huevo", 440]], alert: "sent" },
    { number: 1040, status: "completed", payment: "captured", ageMin: 130, acceptedMin: 127, prep: 15, readyMin: 110, completedMin: 98, name: "Elena Navarro", phone: "+34644556677", email: "elena.n@example.com", lines: [[2, "Maki Pollo Crujiente", 845]], alert: "sent" },
    { number: 1038, status: "rejected", payment: "canceled", ageMin: 95, rejectedMin: 90, reason: "Sin existencias", name: "Sergio Molina", phone: "+34655667788", email: "sergio.m@example.com", lines: [[1, "Sopa de Aleta de Tiburón", 445], [1, "Pato con Naranja", 1195]], alert: "sent" },
    { number: 1037, status: "cancelled", payment: "canceled", ageMin: 180, rejectedMin: 150, name: "Laura Gil", phone: "+34666778899", email: "laura.gil@example.com", lines: [[1, "Udon Tallarines con Marisco", 845]], alert: "sent" },
    { number: 1036, status: "rejected", payment: "refund_pending", ageMin: 60, rejectedMin: 8, reason: "Cocina cerrada", name: "Diego Romero", phone: "+34677889900", email: "diego.r@example.com", lines: [[1, "Frito Gambas con Atún", 1345]], alert: "sent" },
  ];
  const orders = specs.map((s) => makeOrder(now, s));
  for (const o of orders) {
    const created = Date.parse(o.createdAt);
    o.events.push({ at: o.createdAt, from: null, to: "pending", source: "checkout", actor: null, note: "Pedido creado en la web" });
    o.events.push({ at: o.authorizedAt, from: "pending", to: "awaiting_acceptance", source: "stripe", actor: null, note: "Pago autorizado (sin cobrar)" });
    if (o.acceptedAt) o.events.push({ at: o.acceptedAt, from: "awaiting_acceptance", to: "preparing", source: "staff", actor: "Móvil de Pedro", note: `Pago cobrado. En preparación (${o.prepMinutes} min)` });
    if (o.readyAt) o.events.push({ at: o.readyAt, from: "preparing", to: "ready", source: "staff", actor: "Móvil de Pedro", note: "Listo para recoger" });
    if (o.completedAt) o.events.push({ at: o.completedAt, from: "ready", to: "completed", source: "staff", actor: "Móvil de Ana", note: "Entregado al cliente" });
    if (o.status === "needs_review") {
      o.events.push({ at: iso(created + 20 * MIN), from: "preparing", to: "rejecting", source: "staff", actor: "Móvil de Ana", note: "Rechazado: Cliente no vino" });
      o.events.push({ at: o.updatedAt, from: "rejecting", to: "needs_review", source: "system", actor: "Móvil de Ana", note: "La devolución ha fallado en Stripe (expired_or_canceled_card)" });
    }
    if (o.status === "rejected" || o.status === "cancelled") {
      o.events.push({ at: o.rejectedAt, from: "awaiting_acceptance", to: o.status, source: o.status === "cancelled" ? "system" : "staff", actor: o.status === "cancelled" ? null : "Móvil de Pedro", note: o.status === "cancelled" ? "Nadie lo aceptó a tiempo: pago anulado, no se ha cobrado nada" : `Rechazado: ${o.rejectionReason}` });
    }
    if (o.status === "accepting") o.events.push({ at: o.updatedAt, from: "awaiting_acceptance", to: "accepting", source: "staff", actor: "Móvil de Ana", note: "Aceptado (20 min); cobrando el pago" });
  }
  return orders;
}

// ---------------------------------------------------------------------------
// Mock state + API
// ---------------------------------------------------------------------------

const mock = { scenario: "board", orders: [], nextNumber: 1050, signedIn: true, label: "Móvil de Pedro" };

function reset(scenario) {
  const now = Date.now();
  mock.scenario = scenario;
  mock.orders = scenario === "empty" ? [] : seed(now);
  mock.nextNumber = 1050;
  mock.signedIn = scenario === "board" || scenario === "empty";
  mock.label = "Móvil de Pedro";
}
reset("board");

function addOrder() {
  const now = Date.now();
  const o = makeOrder(now, {
    number: mock.nextNumber++,
    status: "awaiting_acceptance",
    payment: "authorized",
    ageMin: 0,
    name: "Nuria Castillo",
    phone: "+34688990011",
    email: "nuria.c@example.com",
    notes: "Llamad al llegar, por favor.",
    lines: [[2, "Pollo con Salsa Agridulce", 775], [2, "Arroz Blanco", 260]],
    alert: "pending",
  });
  o.events.push({ at: o.createdAt, from: null, to: "pending", source: "checkout", actor: null, note: "Pedido creado en la web" });
  mock.orders.push(o);
  return o;
}

function board(now) {
  const columns = { new: [], preparing: [], ready: [], completed: [], rejected: [] };
  const sorted = [...mock.orders].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  for (const o of sorted) {
    const col = COLUMN[o.status];
    if (col) columns[col].push(card(o, now));
  }
  for (const key of ["new", "preparing", "ready"]) columns[key].reverse();
  return {
    now: iso(now),
    paymentsMode: "stripe-test",
    prepOptions: [15, 20, 30, 45],
    columns,
    health: {
      lastWebhookAt: iso(now - 3 * MIN - 12_000),
      lastCronAt: iso(now - 38_000),
      telegram: {
        configured: true,
        lastSuccessAt: iso(now - 2 * MIN),
        lastErrorAt: iso(now - 64 * MIN),
        lastError: "Too Many Requests: retry after 5",
        failedLast24h: 1,
      },
    },
  };
}

function detail(o, now) {
  return {
    ...card(o, now),
    email: o.email,
    payment: {
      mode: o.mode,
      status: o.paymentStatus,
      stripePaymentIntentId: o.stripePaymentIntentId,
      stripeStatus: { authorized: "requires_capture", captured: "succeeded", canceled: "canceled", refunded: "succeeded", refund_pending: "succeeded", refund_failed: "succeeded" }[o.paymentStatus] ?? null,
      refundStatus: { refunded: "succeeded", refund_pending: "pending", refund_failed: "failed" }[o.paymentStatus] ?? null,
    },
    events: o.events,
    notifications: [
      { kind: "new_order", channel: "telegram", status: o.alert === "pending" ? "pending" : "sent", attempts: o.alert === "pending" ? 1 : 1, lastError: o.alert === "pending" ? "Too Many Requests: retry after 5" : null, sentAt: o.alert === "pending" ? null : o.authorizedAt, nextAttemptAt: o.alert === "pending" ? iso(now + 15_000) : null },
      { kind: "new_order", channel: "telegram", status: "sent", attempts: 1, lastError: null, sentAt: o.authorizedAt, nextAttemptAt: null },
    ],
  };
}

function step(o, to, patch, note, actor) {
  const from = o.status;
  Object.assign(o, patch, { status: to, updatedAt: iso(Date.now()) });
  o.events.push({ at: o.updatedAt, from, to, source: "staff", actor, note });
}

function act(o, action, payload, actor) {
  const now = Date.now();
  const handled = (message) => ({ status: 409, body: { ok: false, error: "already-accepted", message, order: card(o, now) } });
  if (o.number === 1048 && (action === "accept" || action === "reject") && o.status === "awaiting_acceptance") {
    step(o, "preparing", { paymentStatus: "captured", acceptedAt: iso(now), prepMinutes: 30, readyBy: iso(now + 30 * MIN) }, "Pago cobrado. En preparación (30 min)", "Móvil de Ana");
    return handled("Otro dispositivo ya ha gestionado este pedido.");
  }
  switch (action) {
    case "accept": {
      const m = payload.prepMinutes;
      if (!Number.isInteger(m) || m < 5 || m > 180) return { status: 422, body: { ok: false, error: "invalid-prep-minutes", message: "Indica un tiempo entre 5 y 180 minutos.", order: null } };
      if (o.status !== "awaiting_acceptance" && o.status !== "needs_review") return handled("Este pedido ya estaba aceptado.");
      step(o, "preparing", { paymentStatus: "captured", acceptedAt: iso(now), prepMinutes: m, readyBy: iso(now + m * MIN), reviewReason: null }, `Pago cobrado. En preparación (${m} min)`, actor);
      return { status: 200, body: { ok: true, pending: false, message: `Pedido aceptado: listo en unos ${m} min.`, order: card(o, Date.now()) } };
    }
    case "reject": {
      if (!["awaiting_acceptance", "needs_review", "preparing", "ready"].includes(o.status)) return handled("Este pedido ya se había rechazado.");
      const reason = typeof payload.reason === "string" ? payload.reason.trim().slice(0, 200) : "";
      const wasAuthorized = o.paymentStatus === "authorized";
      const message = wasAuthorized ? "Pedido rechazado. Autorización anulada: no se ha cobrado nada al cliente." : "Pedido rechazado. Stripe ha confirmado el reembolso.";
      step(o, "rejected", { paymentStatus: wasAuthorized ? "canceled" : "refunded", rejectedAt: iso(now), rejectionReason: reason || null, reviewReason: null }, reason ? `Rechazado: ${reason}` : "Rechazado", actor);
      return { status: 200, body: { ok: true, pending: false, message, order: card(o, Date.now()) } };
    }
    case "ready":
      if (o.status !== "preparing") return handled("Ahora no se puede hacer eso.");
      step(o, "ready", { readyAt: iso(now) }, "Listo para recoger", actor);
      return { status: 200, body: { ok: true, pending: false, message: "Listo para recoger", order: card(o, Date.now()) } };
    case "complete":
      if (o.status !== "ready") return handled("Ahora no se puede hacer eso.");
      step(o, "completed", { completedAt: iso(now) }, "Entregado al cliente", actor);
      return { status: 200, body: { ok: true, pending: false, message: "Entregado al cliente", order: card(o, Date.now()) } };
    case "retry":
      if (o.status === "accepting") {
        step(o, "preparing", { paymentStatus: "captured", acceptedAt: iso(now), prepMinutes: 20, readyBy: iso(now + 20 * MIN) }, "Pago cobrado. En preparación (20 min)", actor);
        return { status: 200, body: { ok: true, pending: false, message: "Estado actualizado desde Stripe.", order: card(o, Date.now()) } };
      }
      if (o.paymentStatus === "refund_pending") {
        o.paymentStatus = "refunded";
        o.updatedAt = iso(now);
        return { status: 200, body: { ok: true, pending: false, message: "Estado actualizado desde Stripe.", order: card(o, Date.now()) } };
      }
      return { status: 502, body: { ok: false, error: "stripe-unavailable", message: "Stripe no responde. Inténtalo en un minuto.", order: card(o, now) } };
    default:
      return { status: 404, body: { error: "not-found" } };
  }
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

const BASE_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Cache-Control": "no-store",
};

function send(res, status, body, headers = {}) {
  const isBuffer = body instanceof Uint8Array;
  res.writeHead(status, { ...BASE_HEADERS, ...(isBuffer || typeof body === "string" ? {} : { "Content-Type": "application/json; charset=utf-8" }), ...headers });
  res.end(isBuffer || typeof body === "string" ? body : JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve(null);
      }
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function signedIn(req) {
  if (mock.scenario === "board" || mock.scenario === "empty") return mock.signedIn;
  return /(?:^|;\s*)mock_session=1/.test(req.headers.cookie ?? "");
}

function unauthorized(res) {
  if (mock.scenario === "closed") return send(res, 503, { error: "admin-not-configured" });
  return send(res, 401, { error: "unauthorized", login: mock.scenario === "access" ? ["access"] : ["telegram"] });
}

async function handleApi(req, res, url) {
  const path = url.pathname;
  const method = req.method;
  if (method === "POST" && !/^application\/json/i.test(req.headers["content-type"] ?? "")) return send(res, 415, { error: "unsupported-media-type" });
  if (mock.scenario === "closed") return send(res, 503, { error: "admin-not-configured" });

  if (path === "/api/admin/auth/code" && method === "POST") {
    await sleep(400);
    return send(res, 202, { sent: 2, expiresInSeconds: 600 });
  }
  if (path === "/api/admin/auth/verify" && method === "POST") {
    const body = await readJson(req);
    await sleep(400);
    if (!body || !/^\d{6}$/.test(String(body.code ?? ""))) return send(res, 400, { error: "invalid-code", message: "El código tiene 6 cifras." });
    if (body.code !== "123456") return send(res, 401, { error: "invalid-code", message: "Código incorrecto." });
    mock.label = typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 40) : "Móvil del restaurante";
    mock.signedIn = true;
    return send(res, 200, { ok: true, label: mock.label }, { "Set-Cookie": "mock_session=1; Path=/; HttpOnly; SameSite=Strict" });
  }
  if (!signedIn(req)) return unauthorized(res);

  const now = Date.now();
  if (path === "/api/admin/session" && method === "GET") {
    return send(res, 200, { authenticated: true, method: "telegram-code", label: mock.label, loginMethods: ["telegram"] });
  }
  if (path === "/api/admin/auth/logout" && method === "POST") {
    mock.signedIn = false;
    if (mock.scenario === "board") mock.scenario = "signin";
    return send(res, 200, { ok: true, everywhere: false }, { "Set-Cookie": "mock_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0" });
  }
  if (path === "/api/admin/board" && method === "GET") return send(res, 200, board(now));
  const detailMatch = /^\/api\/admin\/orders\/([^/]+)$/.exec(path);
  if (detailMatch && method === "GET") {
    const o = mock.orders.find((x) => x.id === decodeURIComponent(detailMatch[1]));
    return o ? send(res, 200, { order: detail(o, now) }) : send(res, 404, { error: "not-found" });
  }
  const actionMatch = /^\/api\/admin\/orders\/([^/]+)\/([a-z]+)$/.exec(path);
  if (actionMatch && method === "POST") {
    const o = mock.orders.find((x) => x.id === decodeURIComponent(actionMatch[1]));
    if (!o) return send(res, 404, { error: "not-found" });
    const payload = (await readJson(req)) ?? {};
    await sleep(700);
    const result = act(o, actionMatch[2], payload, mock.label);
    return send(res, result.status, result.body);
  }
  return send(res, 404, { error: "not-found" });
}

export async function startMockServer({ port = 8790, host = "127.0.0.1" } = {}) {
  const panel = await loadPanelServer();
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? host}`);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    try {
      if (path === "/__mock/reset" && req.method === "POST") {
        reset(url.searchParams.get("scenario") ?? "board");
        return send(res, 200, { ok: true, scenario: mock.scenario }, { "Set-Cookie": "mock_session=; Path=/; Max-Age=0" });
      }
      if (path === "/__mock/new-order" && req.method === "POST") return send(res, 200, { ok: true, id: addOrder().id });
      if (path === "/admin") {
        const nonce = randomBytes(16).toString("base64url");
        return send(res, 200, panel.panelHtml(nonce), { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": csp(nonce), "X-Robots-Tag": "noindex, nofollow" });
      }
      if (url.pathname.startsWith("/admin/")) {
        const asset = panel.panelAsset(url.pathname);
        if (!asset) return send(res, 404, { error: "not-found" });
        return send(res, 200, asset.body, { "Content-Type": asset.contentType, "Cache-Control": asset.cacheControl, "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'" });
      }
      if (path.startsWith("/api/admin")) return await handleApi(req, res, url);
      if (path === "/") return send(res, 302, "", { Location: "/admin" });
      return send(res, 404, { error: "not-found" });
    } catch (error) {
      console.error(error);
      return send(res, 500, { error: "server" });
    }
  });
  await new Promise((resolve) => server.listen(port, host, resolve));
  return { server, url: `http://${host}:${server.address().port}`, reset, addOrder };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const portArg = process.argv.indexOf("--port");
  const port = portArg > -1 ? Number(process.argv[portArg + 1]) : Number(process.env.PORT ?? 8790);
  const { url } = await startMockServer({ port });
  console.log(`Mock staff panel: ${url}/admin  (sign-in code for the signin scenario: 123456)`);
}
