import type { OrderStatus, PricedLine } from "../../../src/lib/commerce/types";
import { canTransition } from "../../../src/lib/commerce/orders";
import type { D1Like } from "./env";

/** Row shapes as stored in D1 (snake_case, integers for booleans). */
export type OrderRow = {
  id: string;
  token_hash: string;
  status: OrderStatus;
  storefront: string;
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
  created_at: string;
  updated_at: string;
  paid_at: string | null;
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

export type OrderEventRow = {
  id: number;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  source: "checkout" | "stripe" | "staff" | "system";
  actor: string | null;
  stripe_event_id: string | null;
  note: string | null;
  created_at: string;
};

export type NewOrder = Omit<
  OrderRow,
  | "stripe_session_id"
  | "stripe_payment_intent_id"
  | "stripe_payment_status"
  | "stripe_amount_total"
  | "stripe_livemode"
  | "paid_at"
>;

export async function insertOrder(db: D1Like, order: NewOrder, lines: PricedLine[]): Promise<void> {
  const insert = db
    .prepare(
      `INSERT INTO orders (id, token_hash, status, storefront, fulfillment, catalog_id, catalog_version,
        currency, subtotal_cents, delivery_fee_cents, total_cents, customer_name, customer_phone,
        customer_email, customer_notes, delivery_street, delivery_postal_code, delivery_city,
        delivery_notes, age_confirmed, payments_mode, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      order.id,
      order.token_hash,
      order.status,
      order.storefront,
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
}

export async function getOrder(db: D1Like, id: string): Promise<OrderRow | null> {
  return db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(id).first<OrderRow>();
}

export async function getOrderItems(db: D1Like, id: string): Promise<OrderItemRow[]> {
  const res = await db
    .prepare(`SELECT * FROM order_items WHERE order_id = ? ORDER BY position`)
    .bind(id)
    .all<OrderItemRow>();
  return res.results;
}

export async function getOrderEvents(db: D1Like, id: string): Promise<OrderEventRow[]> {
  const res = await db
    .prepare(`SELECT * FROM order_events WHERE order_id = ? ORDER BY id`)
    .bind(id)
    .all<OrderEventRow>();
  return res.results;
}

export async function listOrders(
  db: D1Like,
  options: { status?: OrderStatus; limit: number },
): Promise<(OrderRow & { item_count: number })[]> {
  const where = options.status ? `WHERE o.status = ?` : "";
  const sql = `SELECT o.*, COALESCE((SELECT SUM(quantity) FROM order_items i WHERE i.order_id = o.id), 0) AS item_count
               FROM orders o ${where} ORDER BY o.created_at DESC LIMIT ?`;
  const stmt = options.status
    ? db.prepare(sql).bind(options.status, options.limit)
    : db.prepare(sql).bind(options.limit);
  return (await stmt.all<OrderRow & { item_count: number }>()).results;
}

export async function attachStripeSession(db: D1Like, id: string, sessionId: string, now: string) {
  await db
    .prepare(`UPDATE orders SET stripe_session_id = ?, updated_at = ? WHERE id = ?`)
    .bind(sessionId, now, id)
    .run();
}

export type StripeFields = Partial<
  Pick<
    OrderRow,
    | "stripe_session_id"
    | "stripe_payment_intent_id"
    | "stripe_payment_status"
    | "stripe_amount_total"
    | "stripe_livemode"
  >
>;

export async function updateStripeFields(db: D1Like, id: string, fields: StripeFields, now: string) {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined) as [string, string | number | null][];
  if (!entries.length) return;
  const sets = entries.map(([k]) => `${k} = ?`).join(", ");
  await db
    .prepare(`UPDATE orders SET ${sets}, updated_at = ? WHERE id = ?`)
    .bind(...entries.map(([, v]) => v), now, id)
    .run();
}

export type TransitionResult =
  | { ok: true; from: OrderStatus; to: OrderStatus; changed: boolean }
  | { ok: false; reason: "not-found" | "not-allowed" | "conflict"; from?: OrderStatus };

/**
 * Moves an order to `to` if the lifecycle allows it. The UPDATE is conditional on the
 * status we read, so two concurrent writers cannot both apply a transition.
 */
export async function transitionOrder(
  db: D1Like,
  id: string,
  to: OrderStatus,
  meta: {
    source: OrderEventRow["source"];
    actor?: string | null;
    stripeEventId?: string | null;
    note?: string | null;
    now: string;
  },
): Promise<TransitionResult> {
  const order = await getOrder(db, id);
  if (!order) return { ok: false, reason: "not-found" };
  if (order.status === to) return { ok: true, from: order.status, to, changed: false };
  if (!canTransition(order.status, to)) return { ok: false, reason: "not-allowed", from: order.status };

  const paidAt = to === "paid" ? meta.now : null;
  const res = await db
    .prepare(
      `UPDATE orders SET status = ?, updated_at = ?, paid_at = COALESCE(paid_at, ?)
       WHERE id = ? AND status = ?`,
    )
    .bind(to, meta.now, paidAt, id, order.status)
    .run();
  if (!res.meta.changes) return { ok: false, reason: "conflict", from: order.status };

  await db
    .prepare(
      `INSERT INTO order_events (order_id, from_status, to_status, source, actor, stripe_event_id, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      order.status,
      to,
      meta.source,
      meta.actor ?? null,
      meta.stripeEventId ?? null,
      meta.note ?? null,
      meta.now,
    )
    .run();
  return { ok: true, from: order.status, to, changed: true };
}

export async function recordNote(
  db: D1Like,
  id: string,
  status: OrderStatus,
  meta: { source: OrderEventRow["source"]; stripeEventId?: string | null; note: string; now: string },
) {
  await db
    .prepare(
      `INSERT INTO order_events (order_id, from_status, to_status, source, stripe_event_id, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, status, status, meta.source, meta.stripeEventId ?? null, meta.note, meta.now)
    .run();
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
