// In-memory stand-in for the parts of the Stripe API the order Worker uses, for unit tests
// and the local end-to-end stack. It models the real behaviour that matters here:
// Checkout Sessions, PaymentIntents with manual capture (requires_capture -> succeeded /
// canceled), refunds (succeeded / pending / failed), idempotency keys, 400s for invalid
// state changes, and signed webhook events. Failures can be injected per endpoint.
//
// It is NOT Stripe: no card data, no real money, test ids only.
import { createHmac } from "node:crypto";

let seq = 0;
const nextId = (prefix) => `${prefix}_test_fake${(++seq).toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Form keys like a[b][c] -> nested objects; keys ending in [] (e.g. "expand[]") -> arrays. */
export function parseForm(params) {
  const out = {};
  for (const [rawKey, value] of params) {
    const isArray = rawKey.endsWith("[]");
    const key = isArray ? rawKey.slice(0, -2) : rawKey;
    const parts = key.replace(/\]/g, "").split("[");
    let node = out;
    parts.forEach((part, i) => {
      if (i < parts.length - 1) {
        node = node[part] ??= {};
      } else if (isArray) {
        (node[part] ??= []).push(value);
      } else {
        node[part] = value;
      }
    });
  }
  return out;
}

export function createFakeStripe(options = {}) {
  const state = {
    sessions: new Map(),
    intents: new Map(),
    charges: new Map(),
    refunds: new Map(),
    idempotency: new Map(),
    calls: [],
    failures: [],
    refundOutcome: "succeeded",
    events: [],
  };
  const hostedBase = options.hostedBase ?? "https://checkout.stripe.com/c/pay";
  const now = () => Math.floor((options.now?.() ?? Date.now()) / 1000);

  function error(status, code, message) {
    return { status, body: { error: { type: "invalid_request_error", code, message } } };
  }

  function event(type, object) {
    const evt = { id: nextId("evt"), object: "event", type, livemode: false, created: now(), data: { object: structuredClone(object) } };
    state.events.push(evt);
    return evt;
  }

  function intentView(pi, expand) {
    const view = structuredClone(pi);
    if (expand.includes("latest_charge") && pi.latest_charge) view.latest_charge = structuredClone(state.charges.get(pi.latest_charge));
    return view;
  }

  function createSession(form) {
    const lines = Object.values(form.line_items ?? {});
    const amount = lines.reduce((n, l) => n + Number(l.price_data.unit_amount) * Number(l.quantity), 0);
    const manual =
      form.payment_intent_data?.capture_method === "manual" || form.payment_method_options?.card?.capture_method === "manual";
    const session = {
      id: nextId("cs"),
      object: "checkout.session",
      url: "",
      status: "open",
      payment_status: "unpaid",
      payment_intent: null,
      client_reference_id: form.client_reference_id ?? null,
      metadata: form.metadata ?? {},
      amount_total: amount,
      currency: "eur",
      livemode: false,
      locale: form.locale ?? null,
      success_url: form.success_url,
      cancel_url: form.cancel_url,
      expires_at: Number(form.expires_at ?? now() + 3600),
      _form: form,
      _manual: manual,
    };
    session.url = `${hostedBase}/${session.id}`;
    state.sessions.set(session.id, session);
    return session;
  }

  function publicSession(session) {
    const { _form, _manual, ...rest } = session;
    void _form;
    void _manual;
    return structuredClone(rest);
  }

  /** The customer pays on the hosted page. Returns the webhook events Stripe would send. */
  function completeSession(sessionId, outcome = "authorize") {
    const session = state.sessions.get(sessionId);
    if (!session) throw new Error(`unknown session ${sessionId}`);
    if (session.status !== "open") return []; // a completed or expired session cannot be paid again
    const meta = session._form.payment_intent_data?.metadata ?? {};
    let pi = session.payment_intent ? state.intents.get(session.payment_intent) : null;
    if (!pi) {
      pi = {
        id: nextId("pi"),
        object: "payment_intent",
        status: "requires_payment_method",
        amount: session.amount_total,
        amount_capturable: 0,
        amount_received: 0,
        currency: "eur",
        livemode: false,
        metadata: { ...meta },
        capture_method: session._manual ? "manual" : "automatic_async",
        cancellation_reason: null,
        last_payment_error: null,
        latest_charge: null,
      };
      state.intents.set(pi.id, pi);
      session.payment_intent = pi.id;
    }
    if (outcome === "decline") {
      pi.status = "requires_payment_method";
      pi.last_payment_error = { code: "card_declined", message: "Your card was declined." };
      return [event("payment_intent.payment_failed", pi)];
    }
    const capture = outcome === "capture" || !session._manual;
    const charge = {
      id: nextId("ch"),
      object: "charge",
      amount: pi.amount,
      amount_captured: capture ? pi.amount : 0,
      amount_refunded: 0,
      captured: capture,
      refunded: false,
      payment_intent: pi.id,
      payment_method_details: { type: "card", card: { capture_before: capture ? null : now() + 7 * 86400 } },
    };
    state.charges.set(charge.id, charge);
    pi.latest_charge = charge.id;
    pi.last_payment_error = null;
    if (capture) {
      pi.status = "succeeded";
      pi.amount_received = pi.amount;
    } else {
      pi.status = "requires_capture";
      pi.amount_capturable = pi.amount;
    }
    session.status = "complete";
    session.payment_status = capture ? "paid" : "unpaid";
    const events = [event("checkout.session.completed", publicSession(session))];
    events.push(capture ? event("payment_intent.succeeded", pi) : event("payment_intent.amount_capturable_updated", pi));
    return events;
  }

  function expireSession(sessionId) {
    const session = state.sessions.get(sessionId);
    if (!session || session.status !== "open") return [];
    session.status = "expired";
    return [event("checkout.session.expired", publicSession(session))];
  }

  /** The 7-day card authorisation runs out. */
  function expireAuthorization(piId) {
    const pi = state.intents.get(piId);
    if (!pi || pi.status !== "requires_capture") return [];
    pi.status = "canceled";
    pi.cancellation_reason = "expired";
    pi.amount_capturable = 0;
    return [event("charge.expired", state.charges.get(pi.latest_charge)), event("payment_intent.canceled", pi)];
  }

  /** A pending refund settles (or fails) later, as card refunds sometimes do. */
  function settleRefund(refundId, status = "succeeded") {
    const refund = state.refunds.get(refundId);
    if (!refund) return [];
    refund.status = status;
    if (status === "failed") {
      refund.failure_reason = "expired_or_canceled_card";
      const charge = state.charges.get(state.intents.get(refund.payment_intent).latest_charge);
      charge.amount_refunded -= refund.amount;
      charge.refunded = false;
      return [event("refund.failed", refund)];
    }
    return [event("refund.updated", refund)];
  }

  function injected(method, path) {
    const index = state.failures.findIndex((f) => f.method === method && f.path.test(path));
    if (index === -1) return null;
    const failure = state.failures[index];
    if (--failure.times <= 0) state.failures.splice(index, 1);
    return failure;
  }

  /** Core request handler: (method, path, params, headers) -> { status, body } or { network: true }. */
  function handle(method, path, params, headers = {}) {
    const form = parseForm(params);
    state.calls.push({ method, path, form, headers });
    const failure = injected(method, path);
    if (failure?.afterExecute) {
      // Stripe did the work but the answer never arrived (timeout / dropped connection).
      route(method, path, form);
      return { network: true };
    }
    if (failure?.network) return { network: true };
    if (failure) return error(failure.status ?? 500, failure.code ?? "api_error", failure.message ?? "Injected failure");

    const key = headers["idempotency-key"];
    const cacheKey = key ? `${method} ${path} ${key}` : null;
    if (cacheKey && state.idempotency.has(cacheKey)) return structuredClone(state.idempotency.get(cacheKey));
    const result = route(method, path, form);
    if (cacheKey && result.status < 500) state.idempotency.set(cacheKey, structuredClone(result));
    return result;
  }

  function route(method, path, form) {
    const expand = form.expand ?? [];
    let m;
    if (method === "POST" && path === "/v1/checkout/sessions") return { status: 200, body: publicSession(createSession(form)) };
    if (method === "GET" && (m = /^\/v1\/checkout\/sessions\/([^/]+)$/.exec(path))) {
      const s = state.sessions.get(m[1]);
      return s ? { status: 200, body: publicSession(s) } : error(404, "resource_missing", "No such checkout session");
    }
    if ((m = /^\/v1\/payment_intents\/([^/]+)(?:\/(capture|cancel))?$/.exec(path))) {
      const pi = state.intents.get(m[1]);
      if (!pi) return error(404, "resource_missing", "No such payment_intent");
      if (method === "GET" && !m[2]) return { status: 200, body: intentView(pi, expand) };
      if (method === "POST" && m[2] === "capture") {
        if (pi.status !== "requires_capture") {
          return error(400, "payment_intent_unexpected_state", `This PaymentIntent could not be captured because it has a status of ${pi.status}.`);
        }
        pi.status = "succeeded";
        pi.amount_received = pi.amount;
        pi.amount_capturable = 0;
        const charge = state.charges.get(pi.latest_charge);
        charge.captured = true;
        charge.amount_captured = pi.amount;
        event("charge.captured", charge);
        event("payment_intent.succeeded", pi);
        return { status: 200, body: intentView(pi, expand) };
      }
      if (method === "POST" && m[2] === "cancel") {
        if (!["requires_capture", "requires_payment_method", "requires_confirmation", "requires_action"].includes(pi.status)) {
          return error(400, "payment_intent_unexpected_state", `You cannot cancel this PaymentIntent because it has a status of ${pi.status}.`);
        }
        pi.status = "canceled";
        pi.cancellation_reason = form.cancellation_reason ?? null;
        pi.amount_capturable = 0;
        event("payment_intent.canceled", pi);
        return { status: 200, body: intentView(pi, expand) };
      }
    }
    if (method === "POST" && path === "/v1/refunds") {
      const pi = state.intents.get(form.payment_intent);
      if (!pi) return error(404, "resource_missing", "No such payment_intent");
      if (pi.status === "requires_capture") return error(400, "payment_intent_unexpected_state", "You must cancel the PaymentIntent.");
      if (pi.status !== "succeeded") return error(400, "charge_not_refundable", "This charge cannot be refunded.");
      const charge = state.charges.get(pi.latest_charge);
      const amount = Number(form.amount ?? pi.amount_received - charge.amount_refunded);
      if (amount <= 0 || charge.amount_refunded + amount > pi.amount_received) {
        return error(400, "charge_already_refunded", "Charge has already been refunded.");
      }
      const outcome = state.refundOutcome;
      const refund = {
        id: nextId("re"),
        object: "refund",
        amount,
        payment_intent: pi.id,
        status: outcome,
        failure_reason: outcome === "failed" ? "declined" : null,
        metadata: form.metadata ?? {},
      };
      state.refunds.set(refund.id, refund);
      if (outcome !== "failed") {
        charge.amount_refunded += amount;
        charge.refunded = charge.amount_refunded >= pi.amount_received;
      }
      event("refund.created", refund);
      if (outcome !== "failed") event("charge.refunded", charge);
      return { status: 200, body: structuredClone(refund) };
    }
    if (method === "GET" && (m = /^\/v1\/refunds\/([^/]+)$/.exec(path))) {
      const r = state.refunds.get(m[1]);
      return r ? { status: 200, body: structuredClone(r) } : error(404, "resource_missing", "No such refund");
    }
    return error(404, "unknown_route", `${method} ${path} is not emulated`);
  }

  /** fetch() replacement for code that calls `${apiBase}/...` (apiBase ending in /v1). */
  function fetchFor() {
    return async (input, init = {}) => {
      const url = new URL(typeof input === "string" ? input : input.url);
      const path = url.pathname; // apiBase ends with /v1, as Stripe's does
      const headers = Object.fromEntries(new Headers(init.headers).entries());
      const params = init.method === "POST" ? new URLSearchParams(String(init.body ?? "")) : url.searchParams;
      const res = handle(init.method ?? "GET", path, params, headers);
      if (res.network) throw new TypeError("fetch failed (injected network error)");
      return new Response(JSON.stringify(res.body), { status: res.status, headers: { "Content-Type": "application/json" } });
    };
  }

  return {
    state,
    handle,
    fetchFor,
    completeSession,
    expireSession,
    expireAuthorization,
    settleRefund,
    event,
    /** Next matching call fails: { method, path: RegExp, status?, code?, network?, afterExecute?, times? } */
    failNext(failure) {
      state.failures.push({ times: 1, ...failure });
    },
    setRefundOutcome(outcome) {
      state.refundOutcome = outcome;
    },
    session: (id) => state.sessions.get(id),
    intent: (id) => state.intents.get(id),
    takeEvents() {
      return state.events.splice(0, state.events.length);
    },
  };
}

/** Stripe-Signature header for a payload (same scheme as Stripe: HMAC-SHA256 over `${t}.${body}`). */
export function signPayload(body, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const sig = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${sig}`;
}
