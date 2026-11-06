import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { getOrderability } from "../../../src/lib/commerce/catalog";
import { quoteLines } from "../../../src/lib/commerce/pricing";
import { shangHaiCatalog, shangHaiOrdering } from "../../../src/lib/shang-hai/catalog";
import {
  call,
  deliver,
  placedOrder,
  postJson,
  runCron,
  signedWebhook,
  staffAction,
  staffCookie,
  validCheckout,
  world,
  WORKER_ORIGIN,
  type World,
} from "./helpers";

/**
 * Property-based tests (fast-check): random sequences of staff actions — some simultaneous —,
 * cron runs, clock jumps, Stripe failures of every kind (400/404/409/429/5xx, no answer, an
 * answer lost after Stripe acted), late / duplicated / reordered / lost webhooks, refunds that
 * stay pending or fail, and expired authorisations. After every step the financial safety
 * invariants are checked against the fake Stripe and D1; at the end, once everything calms
 * down, the liveness ones (no stuck lock, no forgotten refund, D1 agrees with Stripe).
 *
 * Failures print a seed and a path: rerun exactly with PROPERTY_SEED=<seed> PROPERTY_PATH=<path>.
 * PROPERTY_RUNS sets how many sequences run (default 40; `npm run qa:full` uses more).
 */

const RUNS = Number(process.env.PROPERTY_RUNS ?? 40);
const replay = process.env.PROPERTY_SEED ? { seed: Number(process.env.PROPERTY_SEED), path: process.env.PROPERTY_PATH } : {};

type Target = "capture" | "cancel" | "refund" | "intent" | "refundList";
const TARGETS: Record<Target, { method: "GET" | "POST"; path: RegExp }> = {
  capture: { method: "POST", path: /\/capture$/ },
  cancel: { method: "POST", path: /\/cancel$/ },
  refund: { method: "POST", path: /^\/v1\/refunds$/ },
  intent: { method: "GET", path: /^\/v1\/payment_intents\// },
  refundList: { method: "GET", path: /^\/v1\/refunds$/ },
};

const order = fc.nat({ max: 2 });
const phone = fc.constantFrom(0, 1);
const action = fc.constantFrom("accept", "reject", "retry", "ready", "complete", "cron");
const command = fc.oneof(
  { weight: 4, arbitrary: fc.record({ t: fc.constant("accept" as const), o: order, p: phone, minutes: fc.constantFrom(15, 20, 30), stale: fc.boolean() }) },
  { weight: 3, arbitrary: fc.record({ t: fc.constant("reject" as const), o: order, p: phone, stale: fc.boolean() }) },
  { weight: 2, arbitrary: fc.record({ t: fc.constant("ready" as const), o: order }) },
  { weight: 1, arbitrary: fc.record({ t: fc.constant("complete" as const), o: order }) },
  { weight: 1, arbitrary: fc.record({ t: fc.constant("retry" as const), o: order, p: phone }) },
  { weight: 3, arbitrary: fc.record({ t: fc.constant("race" as const), o: order, a: action, b: action }) },
  { weight: 2, arbitrary: fc.record({ t: fc.constant("cron" as const) }) },
  { weight: 2, arbitrary: fc.record({ t: fc.constant("advance" as const), ms: fc.constantFrom(5_000, 60_000, 95_000, 6 * 60_000, 31 * 60_000) }) },
  { weight: 3, arbitrary: fc.record({ t: fc.constant("webhooks" as const), mode: fc.constantFrom("in-order", "reversed", "duplicated", "drop-half", "hold") }) },
  {
    weight: 3,
    arbitrary: fc.record({
      t: fc.constant("fail" as const),
      target: fc.constantFrom<Target>("capture", "cancel", "refund", "intent", "refundList"),
      kind: fc.constantFrom("400", "404", "409", "429", "500", "502", "503", "504", "network", "lost-answer"),
      times: fc.constantFrom(1, 2, 4),
    }),
  },
  { weight: 1, arbitrary: fc.record({ t: fc.constant("refundOutcome" as const), v: fc.constantFrom("succeeded", "pending", "failed") }) },
  { weight: 1, arbitrary: fc.record({ t: fc.constant("settle" as const), v: fc.constantFrom("succeeded", "failed") }) },
  { weight: 1, arbitrary: fc.record({ t: fc.constant("expire" as const), o: order }) },
);
type Command = typeof command extends fc.Arbitrary<infer C> ? C : never;

type Run = { w: World; ids: string[]; cookies: string[]; serverErrors: string[] };

const row = (w: World, id: string) => w.env.DB.raw.prepare("SELECT * FROM orders WHERE id = ?").get(id) as Record<string, string | number | null>;

async function staff(run: Run, p: number, id: string, act: string, body: Record<string, unknown> = {}) {
  const res = await staffAction(run.w, run.cookies[p], id, act, body);
  if (res.status === 500) run.serverErrors.push(`${act} ${id}: ${JSON.stringify(res.body)}`);
  return res;
}

async function perform(run: Run, act: string, id: string, p: number, extra: { minutes?: number; stale?: boolean } = {}) {
  const current = String(row(run.w, id).status);
  const shown = extra.stale ? "awaiting_acceptance" : current;
  switch (act) {
    case "accept":
      return staff(run, p, id, "accept", { prepMinutes: extra.minutes ?? 20, expectedStatus: shown });
    case "reject":
      return staff(run, p, id, "reject", { reason: "Sin existencias", expectedStatus: shown });
    case "retry":
    case "ready":
    case "complete":
      return staff(run, p, id, act);
    case "cron":
      return runCron(run.w);
  }
}

async function apply(run: Run, c: Command) {
  const { w, ids } = run;
  switch (c.t) {
    case "accept":
      return perform(run, "accept", ids[c.o % ids.length], c.p, { minutes: c.minutes, stale: c.stale });
    case "reject":
      return perform(run, "reject", ids[c.o % ids.length], c.p, { stale: c.stale });
    case "ready":
    case "complete":
    case "retry":
      return perform(run, c.t, ids[c.o % ids.length], "p" in c ? c.p : 0);
    case "race": {
      const id = ids[c.o % ids.length];
      return Promise.all([perform(run, c.a, id, 0), perform(run, c.b, id, 1)]);
    }
    case "cron":
      return runCron(w);
    case "advance":
      return w.advance(c.ms);
    case "webhooks": {
      if (c.mode === "hold") return;
      let events: unknown[] = w.stripe.takeEvents();
      if (c.mode === "reversed") events = events.reverse();
      if (c.mode === "duplicated") events = events.flatMap((e: unknown) => [e, e]);
      if (c.mode === "drop-half") events = events.filter((_: unknown, i: number) => i % 2 === 0);
      return deliver(w, events);
    }
    case "fail": {
      const { method, path } = TARGETS[c.target];
      if (c.kind === "network") return w.stripe.failNext({ method, path, network: true, times: c.times });
      if (c.kind === "lost-answer") return w.stripe.failNext({ method, path, network: true, afterExecute: method === "POST", times: c.times });
      return w.stripe.failNext({ method, path, status: Number(c.kind), times: c.times });
    }
    case "refundOutcome":
      return w.stripe.setRefundOutcome(c.v);
    case "settle": {
      const pending = [...w.stripe.state.refunds.values()].find((r) => r.status === "pending");
      if (pending) w.stripe.settleRefund(pending.id, c.v);
      return;
    }
    case "expire": {
      const pi = row(w, ids[c.o % ids.length]).stripe_payment_intent_id;
      if (pi) w.stripe.expireAuthorization(String(pi));
      return;
    }
  }
}

/** Money facts at the fake Stripe for one order. */
function stripeFacts(w: World, id: string) {
  const piId = row(w, id).stripe_payment_intent_id;
  const pi = piId ? w.stripe.intent(String(piId)) : null;
  const charge = pi?.latest_charge ? w.stripe.state.charges.get(pi.latest_charge) : null;
  const refunds = [...w.stripe.state.refunds.values()].filter((r) => r.payment_intent === piId);
  const alive = refunds.filter((r) => r.status !== "failed" && r.status !== "canceled");
  return {
    pi,
    charge,
    refunds,
    alive: alive.reduce((n, r) => n + r.amount, 0),
    refundedOk: alive.length > 0 && alive.every((r) => r.status === "succeeded") ? alive.reduce((n, r) => n + r.amount, 0) : 0,
  };
}

/** Safety: must hold after EVERY step, whatever is still in flight. */
function checkSafety(run: Run, step: string) {
  const { w } = run;
  expect(run.serverErrors, `unexpected 500s after ${step}`).toEqual([]);
  for (const id of run.ids) {
    const r = row(w, id);
    const s = stripeFacts(w, id);
    const at = `${step} · order ${id} ${r.status}/${r.payment_status}, Stripe ${s.pi?.status}`;
    if (s.pi) {
      expect(s.pi.amount_received, `captured more than authorised — ${at}`).toBeLessThanOrEqual(s.pi.amount);
      if (s.charge) expect(s.charge.amount_captured, `charged more than the order — ${at}`).toBeLessThanOrEqual(s.pi.amount);
      expect(s.alive, `refunded more than was charged — ${at}`).toBeLessThanOrEqual(s.pi.amount_received);
      expect(s.pi.amount, `Stripe amount differs from the order total — ${at}`).toBe(r.total_cents);
    }
    // Never shown as charged, or sent to the kitchen, without Stripe's confirmation.
    if (r.payment_status === "captured" || ["preparing", "ready", "completed"].includes(String(r.status))) {
      expect(s.pi?.status, `claims money Stripe did not take — ${at}`).toBe("succeeded");
    }
    // Never shown as refunded unless Stripe confirmed refunds covering the charge.
    if (r.payment_status === "refunded") {
      expect(s.refundedOk, `claims a refund Stripe has not confirmed — ${at}`).toBeGreaterThanOrEqual(Number(s.pi?.amount_received ?? 0));
    }
  }
}

/** Liveness: once Stripe is healthy and time passes, everything settles truthfully. */
async function settleAndCheck(run: Run) {
  const { w } = run;
  w.stripe.clearFailures();
  for (let i = 0; i < 30; i++) {
    await deliver(w, w.stripe.takeEvents());
    w.advance(6 * 60_000);
    await runCron(w);
  }
  await deliver(w, w.stripe.takeEvents());
  checkSafety(run, "settled");
  for (const id of run.ids) {
    const r = row(w, id);
    const s = stripeFacts(w, id);
    const at = `order ${id} ${r.status}/${r.payment_status}, Stripe ${s.pi?.status}, refunds ${s.refunds.map((x) => x.status).join(",")}`;
    expect(["accepting", "rejecting"], `lock never resolved — ${at}`).not.toContain(r.status);
    // The obligation to return money is never lost: charged + declined ⇒ refunded/refunding, or a person is on it.
    if (s.pi?.status === "succeeded" && ["rejected", "cancelled"].includes(String(r.status))) {
      expect(s.alive, `money kept for a declined order — ${at}`).toBeGreaterThanOrEqual(s.pi.amount_received);
    }
    // Holds still on the card for an order that will not be prepared are released (or reviewed).
    if (s.pi?.status === "requires_capture" && ["rejected", "cancelled"].includes(String(r.status))) {
      throw new Error(`hold left on the card for a declined order — ${at}`);
    }
    // Every incident that needs a person has been alerted.
    if (r.status === "needs_review") {
      const alerted = w.env.DB.raw
        .prepare("SELECT COUNT(*) AS n FROM notifications WHERE order_id = ? AND kind = 'needs_review' AND status IN ('sent', 'pending', 'sending')")
        .get(id) as { n: number };
      expect(Number(alerted.n), `incident never alerted — ${at}`).toBeGreaterThan(0);
    } else if (s.pi) {
      // Outside review, D1 says what Stripe says.
      const expected =
        s.pi.status === "requires_capture"
          ? "authorized"
          : s.pi.status === "canceled"
            ? "canceled"
            : s.refundedOk >= s.pi.amount_received && s.pi.amount_received > 0
              ? "refunded"
              : s.alive >= s.pi.amount_received && s.pi.amount_received > 0
                ? "refund_pending"
                : "captured";
      expect(r.payment_status, `D1 disagrees with Stripe — ${at}`).toBe(expected);
    }
  }
}

describe("order lifecycle under random concurrency and failures (property)", () => {
  for (const mode of ["manual", "per-method"] as const) {
    it(`keeps every money invariant (${mode} capture)`, async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 3 }), fc.array(command, { minLength: 1, maxLength: 28 }), async (orders, commands) => {
          const w = world({ STRIPE_CAPTURE_MODE: mode, ACCEPTANCE_TIMEOUT_MINUTES: "30", ACCEPTANCE_REMINDER_MINUTES: "4" });
          const ids: string[] = [];
          for (let i = 0; i < orders; i++) ids.push((await placedOrder(w, {}, mode === "manual" ? "authorize" : "capture")).orderId);
          const run: Run = { w, ids, cookies: [await staffCookie(w.env, "Móvil A", w.now()), await staffCookie(w.env, "Móvil B", w.now())], serverErrors: [] };
          for (const [i, c] of commands.entries()) {
            await apply(run, c);
            await w.deps.flush();
            checkSafety(run, `step ${i} ${JSON.stringify(c)}`);
          }
          await settleAndCheck(run);
        }),
        { numRuns: RUNS, ...replay },
      );
    }, 300_000);
  }
});

// ---------------------------------------------------------------------------
// Prices: the storefront, the server and Stripe always agree
// ---------------------------------------------------------------------------

const simpleItems = shangHaiCatalog.visibleItems.filter((i) => getOrderability(i).orderable && !(i.options?.length ?? 0));

describe("prices (property)", () => {
  it("any valid cart costs the same in the browser's quote, on the server and at Stripe", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(fc.record({ item: fc.constantFrom(...simpleItems), quantity: fc.integer({ min: 1, max: 6 }) }), { minLength: 1, maxLength: 6, selector: (l) => l.item.id }),
        async (lines) => {
          const w = world();
          const input = lines.map((l) => ({ itemId: l.item.id, quantity: l.quantity }));
          const quote = quoteLines(shangHaiCatalog, input.map((l) => ({ ...l, key: l.itemId, selections: {} })), {
            fulfillment: "pickup",
            delivery: shangHaiOrdering.delivery,
            limits: shangHaiOrdering.limits,
          });
          fc.pre(quote.payable);
          const res = await postJson(w.env, w.deps, "/api/checkout", validCheckout({ lines: input, expectedTotalCents: quote.totalCents, ageConfirmed: true }));
          expect(res.status).toBe(201);
          const session = [...w.stripe.state.sessions.values()][0];
          expect(session.amount_total).toBe(quote.totalCents);
          const row = w.env.DB.raw.prepare("SELECT total_cents FROM orders").get() as { total_cents: number };
          expect(row.total_cents).toBe(quote.totalCents);
        },
      ),
      { numRuns: RUNS, ...replay },
    );
  });
});

// ---------------------------------------------------------------------------
// Fuzzing: hostile or broken input never crashes the server or slips through
// ---------------------------------------------------------------------------

describe("fuzzing (property)", () => {
  it("checkout: any JSON body gets a 4xx or a valid order — never a 500, never a wrong price", async () => {
    const w = world();
    const quantity = fc.oneof(fc.integer({ min: -5, max: 30 }), fc.double(), fc.string(), fc.constant(null), fc.constant(1e308));
    const line = fc.record({ itemId: fc.oneof(fc.constantFrom(...simpleItems.map((i) => i.id)), fc.string()), quantity }, { requiredKeys: [] });
    const body = fc.oneof(
      fc.anything(),
      fc.record(
        {
          catalogId: fc.oneof(fc.constant("shang-hai-orihuela"), fc.string()),
          storefront: fc.oneof(fc.constantFrom("ink-house", "wok-after-dark", "bento-club"), fc.string()),
          fulfillment: fc.oneof(fc.constant("pickup"), fc.string()),
          lines: fc.oneof(fc.array(line, { maxLength: 8 }), fc.anything()),
          customer: fc.oneof(fc.record({ name: fc.string(), phone: fc.string(), email: fc.string(), notes: fc.string() }, { requiredKeys: [] }), fc.anything()),
          expectedTotalCents: fc.oneof(fc.integer(), fc.anything()),
          locale: fc.oneof(fc.constantFrom("es", "en"), fc.string()),
        },
        { requiredKeys: [] },
      ),
    );
    await fc.assert(
      fc.asyncProperty(body, async (payload) => {
        const res = await postJson(w.env, w.deps, "/api/checkout", JSON.stringify(payload) ?? "null");
        expect([201, 400, 409, 413, 415, 422, 429]).toContain(res.status);
        if (res.status === 201) {
          const { orderId } = (await res.json()) as { orderId: string };
          const stored = w.env.DB.raw.prepare("SELECT total_cents FROM orders WHERE id = ?").get(orderId) as { total_cents: number };
          const items = w.env.DB.raw.prepare("SELECT SUM(line_total_cents) AS n FROM order_items WHERE order_id = ?").get(orderId) as { n: number };
          expect(stored.total_cents).toBe(Number(items.n));
        }
      }),
      { numRuns: RUNS * 5, ...replay },
    );
  });

  it("staff actions: any body is validated — never a 500, prep time always within 5–180, reason bounded", async () => {
    const w = world();
    const cookie = await staffCookie(w.env, "Fuzz", w.now());
    const ids = [(await placedOrder(w)).orderId, (await placedOrder(w)).orderId];
    const body = fc.record(
      {
        prepMinutes: fc.oneof(fc.integer({ min: -10, max: 400 }), fc.double(), fc.string(), fc.constant(null), fc.anything()),
        reason: fc.oneof(fc.string({ maxLength: 600 }), fc.anything(), fc.constant("<script>alert(1)</script>")),
        expectedStatus: fc.oneof(fc.constantFrom("awaiting_acceptance", "preparing", "needs_review"), fc.string(), fc.anything()),
      },
      { requiredKeys: [] },
    );
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...ids), fc.constantFrom("accept", "reject", "ready", "complete", "retry", "nope"), body, async (id, act, payload) => {
        const res = await call(w.env, w.deps, `/api/admin/orders/${id}/${act}`, {
          method: "POST",
          headers: { Cookie: cookie, Origin: WORKER_ORIGIN, "Content-Type": "application/json" },
          body: JSON.stringify(payload) ?? "{}",
        });
        await w.deps.flush();
        expect(res.status).not.toBe(500);
        const r = row(w, id);
        if (r.prep_minutes !== null) expect(Number(r.prep_minutes)).toBeGreaterThanOrEqual(5);
        if (r.prep_minutes !== null) expect(Number(r.prep_minutes)).toBeLessThanOrEqual(180);
        if (r.rejection_reason !== null) expect(String(r.rejection_reason).length).toBeLessThanOrEqual(200);
      }),
      { numRuns: RUNS * 3, ...replay },
    );
  });

  it("webhook: any signed payload is answered without crashing and never changes an order it does not belong to", async () => {
    const w = world();
    const placed = await placedOrder(w);
    const before = JSON.stringify(row(w, placed.orderId));
    const event = fc.record(
      {
        id: fc.string(),
        type: fc.oneof(fc.constantFrom("payment_intent.succeeded", "checkout.session.completed", "charge.refunded", "refund.updated"), fc.string()),
        livemode: fc.boolean(),
        data: fc.oneof(fc.record({ object: fc.oneof(fc.record({ id: fc.string(), object: fc.string(), metadata: fc.dictionary(fc.string(), fc.string()) }, { requiredKeys: [] }), fc.anything()) }), fc.anything()),
      },
      { requiredKeys: [] },
    );
    await fc.assert(
      fc.asyncProperty(fc.oneof(event, fc.anything()), async (payload) => {
        const res = await signedWebhook(w.env, payload, { now: w.now(), deps: w.deps });
        expect([200, 400, 503]).toContain(res.status);
      }),
      { numRuns: RUNS * 3, ...replay },
    );
    expect(JSON.stringify(row(w, placed.orderId))).toBe(before);
  });
});
