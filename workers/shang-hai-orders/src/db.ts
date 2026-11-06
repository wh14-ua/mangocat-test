import type { OrderStatus, PaymentStatus, PricedLine } from "../../../src/lib/commerce/types";
import { canTransition } from "../../../src/lib/commerce/orders";
import type { D1Like, D1Statement } from "./env";

/** Row shapes as stored in D1 (snake_case, integers for booleans). */
export type OrderRow = {
  id: string;
  number: number | null;
  token_hash: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  storefront: string;
  locale: "es" | "en";
  fulfillment: "pickup" | "delivery";
  catalog_id: string;
  catalog_version: string;
  currency: "EUR";
  subtotal_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_notes: string | null;
  delivery_street: string | null;
  delivery_postal_code: string | null;
  delivery_city: string | null;
  delivery_notes: string | null;
  age_confirmed: number;
  payments_mode: "stripe-test" | "stripe-live";
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_payment_status: string | null;
  stripe_amount_total: number | null;
  stripe_livemode: number | null;
  stripe_capture_before: string | null;
  stripe_refund_id: string | null;
  stripe_refund_status: string | null;
  refund_attempts: number;
  prep_minutes: number | null;
  rejection_reason: string | null;
  review_reason: string | null;
  staff_seen_at: string | null;
  created_at: string;
  updated_at: string;
  authorized_at: string | null;
  paid_at: string | null;
  accepted_at: string | null;
  ready_by: string | null;
  ready_at: string | null;
  completed_at: string | null;
  rejected_at: string | null;
};

export type OrderItemRow = {
  order_id: string;
  position: number;
  item_id: string;
  name: string;
  options_label: string | null;
  selections_json: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  age_restricted: number;
};

export type EventSource = "checkout" | "stripe" | "staff" | "system";

export type OrderEventRow = {
  id: number;
  order_id: string;
  from_status: string | null;
  to_status: string;
  source: EventSource;
  actor: string | null;
  stripe_event_id: string | null;
  note: string | null;
  created_at: string;
};

export type NewOrder = Pick<
  OrderRow,
  | "id"
  | "token_hash"
  | "storefront"
  | "locale"
  | "fulfillment"
  | "catalog_id"
  | "catalog_version"
  | "currency"
  | "subtotal_cents"
  | "delivery_fee_cents"
  | "total_cents"
  | "customer_name"
  | "customer_phone"
  | "customer_email"
  | "customer_notes"
  | "delivery_street"
  | "delivery_postal_code"
  | "delivery_city"
  | "delivery_notes"
  | "age_confirmed"
  | "payments_mode"
  | "created_at"
  | "updated_at"
>;

/** First counter number. Numbers are global and never reused (#1001, #1002…). */
export const FIRST_ORDER_NUMBER = 1001;

/**
 * Stores a pending order with its lines in one transaction and returns its counter
 * number. The number is computed inside the INSERT (MAX + 1) and protected by a UNIQUE
 * index; D1 runs writes one at a time, so two checkouts never get the same number.
 */
export async function insertOrder(db: D1Like, order: NewOrder, lines: PricedLine[]): Promise<number> {
  const insert = db
    .prepare(
      `INSERT INTO orders (id, number, token_hash, status, payment_status, storefront, locale, fulfillment,
        catalog_id, catalog_version, currency, subtotal_cents, delivery_fee_cents, total_cents,
        customer_name, customer_phone, customer_email, customer_notes, delivery_street,
        delivery_postal_code, delivery_city, delivery_notes, age_confirmed, payments_mode,
        created_at, updated_at)
       VALUES (?, (SELECT COALESCE(MAX(number), ${FIRST_ORDER_NUMBER - 1}) + 1 FROM orders), ?, 'pending', 'unpaid',
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      order.id,
      order.token_hash,
      order.storefront,
      order.locale,
      order.fulfillment,
      order.catalog_id,
      order.catalog_version,
      order.currency,
      order.subtotal_cents,
      order.delivery_fee_cents,
      order.total_cents,
      order.customer_name,
      order.customer_phone,
      order.customer_email,
      order.customer_notes,
      order.delivery_street,
      order.delivery_postal_code,
      order.delivery_city,
      order.delivery_notes,
      order.age_confirmed,
      order.payments_mode,
      order.created_at,
      order.updated_at,
    );
  const items = lines.map((line, position) =>
    db
      .prepare(
        `INSERT INTO order_items (order_id, position, item_id, name, options_label, selections_json,
          quantity, unit_price_cents, line_total_cents, age_restricted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        order.id,
        position,
        line.itemId,
        line.name,
        line.optionsLabel ?? null,
        JSON.stringify(line.selections ?? {}),
        line.quantity,
        line.unitPriceCents,
        line.lineTotalCents,
        line.ageRestricted ? 1 : 0,
      ),
  );
  const event = db
    .prepare(
      `INSERT INTO order_events (order_id, from_status, to_status, source, note, created_at)
       VALUES (?, NULL, 'pending', 'checkout', 'Pedido creado; pendiente de pago', ?)`,
    )
    .bind(order.id, order.created_at);
  // D1 batches run in a single transaction: the order is stored completely or not at all.
  await db.batch([insert, ...items, event]);
  const row = await db.prepare(`SELECT number FROM orders WHERE id = ?`).bind(order.id).first<{ number: number }>();
  return row?.number ?? 0;
}

export async function getOrder(db: D1Like, id: string): Promise<OrderRow | null> {
  return db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(id).first<OrderRow>();
}

export async function getOrderByPaymentIntent(db: D1Like, paymentIntentId: string): Promise<OrderRow | null> {
  return db.prepare(`SELECT * FROM orders WHERE stripe_payment_intent_id = ?`).bind(paymentIntentId).first<OrderRow>();
}

export async function getOrderItems(db: D1Like, id: string): Promise<OrderItemRow[]> {
  const res = await db
    .prepare(`SELECT * FROM order_items WHERE order_id = ? ORDER BY position`)
    .bind(id)
    .all<OrderItemRow>();
  return res.results;
}

export async function getItemsForOrders(db: D1Like, ids: string[]): Promise<Map<string, OrderItemRow[]>> {
  const out = new Map<string, OrderItemRow[]>();
  if (!ids.length) return out;
  const placeholders = ids.map(() => "?").join(", ");
  const res = await db
    .prepare(`SELECT * FROM order_items WHERE order_id IN (${placeholders}) ORDER BY order_id, position`)
    .bind(...ids)
    .all<OrderItemRow>();
  for (const item of res.results) {
    const list = out.get(item.order_id) ?? [];
    list.push(item);
    out.set(item.order_id, list);
  }
  return out;
}

export async function getOrderEvents(db: D1Like, id: string): Promise<OrderEventRow[]> {
  const res = await db
    .prepare(`SELECT * FROM order_events WHERE order_id = ? ORDER BY id`)
    .bind(id)
    .all<OrderEventRow>();
  return res.results;
}

/**
 * Orders for the staff board: EVERY order that still needs someone (never cut off by the
 * history), plus today's finished ones (most recent first, bounded).
 */
export async function listBoardOrders(db: D1Like, since: string, historyLimit = 100): Promise<OrderRow[]> {
  const active = await db
    .prepare(
      `SELECT * FROM orders
        WHERE status IN ('awaiting_acceptance', 'accepting', 'rejecting', 'needs_review', 'preparing', 'ready')
        ORDER BY created_at DESC`,
    )
    .all<OrderRow>();
  const finished = await db
    .prepare(
      `SELECT * FROM orders
        WHERE (status IN ('completed', 'rejected') AND updated_at >= ?)
           OR (status = 'cancelled' AND authorized_at IS NOT NULL AND updated_at >= ?)
        ORDER BY updated_at DESC LIMIT ?`,
    )
    .bind(since, since, historyLimit)
    .all<OrderRow>();
  return [...active.results, ...finished.results];
}

export async function attachStripeSession(db: D1Like, id: string, sessionId: string, now: string) {
  await db
    .prepare(`UPDATE orders SET stripe_session_id = ?, updated_at = ? WHERE id = ?`)
    .bind(sessionId, now, id)
    .run();
}

/** Columns a status change may set together with the status. */
export type OrderPatch = Partial<
  Pick<
    OrderRow,
    | "payment_status"
    | "stripe_session_id"
    | "stripe_payment_intent_id"
    | "stripe_payment_status"
    | "stripe_amount_total"
    | "stripe_livemode"
    | "stripe_capture_before"
    | "stripe_refund_id"
    | "stripe_refund_status"
    | "refund_attempts"
    | "prep_minutes"
    | "rejection_reason"
    | "review_reason"
    | "authorized_at"
    | "paid_at"
    | "accepted_at"
    | "ready_by"
    | "ready_at"
    | "completed_at"
    | "rejected_at"
  >
>;

const PATCH_COLUMNS = new Set<string>([
  "payment_status",
  "stripe_session_id",
  "stripe_payment_intent_id",
  "stripe_payment_status",
  "stripe_amount_total",
  "stripe_livemode",
  "stripe_capture_before",
  "stripe_refund_id",
  "stripe_refund_status",
  "refund_attempts",
  "prep_minutes",
  "rejection_reason",
  "review_reason",
  "authorized_at",
  "paid_at",
  "accepted_at",
  "ready_by",
  "ready_at",
  "completed_at",
  "rejected_at",
]);

export type EventMeta = {
  source: EventSource;
  actor?: string | null;
  stripeEventId?: string | null;
  note?: string | null;
  now: string;
};

function eventStatement(db: D1Like, id: string, from: string | null, to: string, meta: EventMeta): D1Statement {
  return db
    .prepare(
      `INSERT INTO order_events (order_id, from_status, to_status, source, actor, stripe_event_id, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, from, to, meta.source, meta.actor ?? null, meta.stripeEventId ?? null, meta.note ?? null, meta.now);
}

export type UpdateResult = { ok: true; changed: boolean } | { ok: false; reason: "conflict" };

/**
 * Conditional update: applies `to` (or keeps the status when null) and `patch` ONLY if the
 * order is still in `from`. This is the concurrency guard of the whole system: two staff
 * phones tapping ACEPTAR, or a webhook racing a staff action, can never both win. The
 * history row is written in the same transaction.
 */
export async function updateOrderIf(
  db: D1Like,
  id: string,
  from: OrderStatus,
  to: OrderStatus | null,
  patch: OrderPatch,
  meta: EventMeta | null,
  now?: string,
): Promise<UpdateResult> {
  const entries = Object.entries(patch).filter(([k, v]) => PATCH_COLUMNS.has(k) && v !== undefined) as [
    string,
    string | number | null,
  ][];
  const sets = [...(to ? ["status = ?"] : []), ...entries.map(([k]) => `${k} = ?`), "updated_at = ?"];
  const values: (string | number | null)[] = [...(to ? [to] : []), ...entries.map(([, v]) => v), meta?.now ?? now ?? new Date().toISOString()];
  const update = db
    .prepare(`UPDATE orders SET ${sets.join(", ")} WHERE id = ? AND status = ?`)
    .bind(...values, id, from);
  if (!meta) {
    const res = await update.run();
    return res.meta.changes ? { ok: true, changed: true } : { ok: false, reason: "conflict" };
  }
  // The event insert only happens if the UPDATE matched (same transaction, guarded by status).
  const event = db
    .prepare(
      `INSERT INTO order_events (order_id, from_status, to_status, source, actor, stripe_event_id, note, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE changes() > 0`,
    )
    .bind(id, from, to ?? from, meta.source, meta.actor ?? null, meta.stripeEventId ?? null, meta.note ?? null, meta.now);
  const [res] = await db.batch([update, event]);
  return res.meta.changes ? { ok: true, changed: true } : { ok: false, reason: "conflict" };
}

/**
 * The accept/reject lock an order is in: how many times one was taken (each attempt gets its
 * own Stripe idempotency key) and when the current one was taken (for the review deadline).
 */
export async function lockInfo(db: D1Like, orderId: string, status: "accepting" | "rejecting"): Promise<{ attempts: number; since: string | null }> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n, MAX(created_at) AS since FROM order_events
        WHERE order_id = ? AND to_status = ? AND from_status IS NOT NULL AND from_status <> to_status`,
    )
    .bind(orderId, status)
    .first<{ n: number; since: string | null }>();
  return { attempts: Number(row?.n ?? 0), since: row?.since ?? null };
}

export type TransitionResult =
  | { ok: true; from: OrderStatus; to: OrderStatus; changed: boolean }
  | { ok: false; reason: "not-found" | "not-allowed" | "conflict"; from?: OrderStatus };

/** Moves an order to `to` if the lifecycle allows it (conditional on the status read). */
export async function transitionOrder(
  db: D1Like,
  id: string,
  to: OrderStatus,
  meta: EventMeta,
  patch: OrderPatch = {},
): Promise<TransitionResult> {
  const order = await getOrder(db, id);
  if (!order) return { ok: false, reason: "not-found" };
  if (order.status === to) return { ok: true, from: order.status, to, changed: false };
  if (!canTransition(order.status, to)) return { ok: false, reason: "not-allowed", from: order.status };
  const res = await updateOrderIf(db, id, order.status, to, patch, meta);
  if (!res.ok) return { ok: false, reason: "conflict", from: order.status };
  return { ok: true, from: order.status, to, changed: true };
}

export async function recordNote(db: D1Like, id: string, status: OrderStatus, meta: EventMeta & { note: string }) {
  await eventStatement(db, id, status, status, meta).run();
}

// ---------------------------------------------------------------------------
// Stripe event idempotency
// ---------------------------------------------------------------------------

export type StripeEventClaim = "new" | "retry" | "duplicate";

/**
 * Registers a Stripe event id. "duplicate" means it was already fully handled and must
 * not be processed again; "retry" means a previous delivery failed half-way.
 */
export async function claimStripeEvent(
  db: D1Like,
  event: { id: string; type: string; livemode: boolean },
  now: string,
): Promise<StripeEventClaim> {
  const res = await db
    .prepare(
      `INSERT OR IGNORE INTO stripe_events (id, type, livemode, status, received_at)
       VALUES (?, ?, ?, 'received', ?)`,
    )
    .bind(event.id, event.type, event.livemode ? 1 : 0, now)
    .run();
  if (res.meta.changes) return "new";
  const existing = await db
    .prepare(`SELECT status FROM stripe_events WHERE id = ?`)
    .bind(event.id)
    .first<{ status: string }>();
  return existing && (existing.status === "processed" || existing.status === "ignored")
    ? "duplicate"
    : "retry";
}

export async function finishStripeEvent(
  db: D1Like,
  id: string,
  status: "processed" | "ignored" | "failed",
  orderId: string | null,
  now: string,
) {
  await db
    .prepare(`UPDATE stripe_events SET status = ?, order_id = COALESCE(?, order_id), processed_at = ? WHERE id = ?`)
    .bind(status, orderId, now, id)
    .run();
}

// ---------------------------------------------------------------------------
// System state (health of webhooks, cron and notifications)
// ---------------------------------------------------------------------------

export async function setState(db: D1Like, key: string, value: string, now: string) {
  await db
    .prepare(
      `INSERT INTO system_state (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(key, value, now)
    .run();
}

export async function getStates(db: D1Like): Promise<Record<string, { value: string; updatedAt: string }>> {
  const res = await db.prepare(`SELECT key, value, updated_at FROM system_state`).all<{ key: string; value: string; updated_at: string }>();
  return Object.fromEntries(res.results.map((r) => [r.key, { value: r.value, updatedAt: r.updated_at }]));
}

/** Records that staff have had these orders on screen (first time only). */
export async function markSeenByStaff(db: D1Like, ids: string[], now: string) {
  if (!ids.length) return;
  await db
    .prepare(`UPDATE orders SET staff_seen_at = ? WHERE staff_seen_at IS NULL AND id IN (${ids.map(() => "?").join(", ")})`)
    .bind(now, ...ids)
    .run();
}
