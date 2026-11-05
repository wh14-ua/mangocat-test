-- Shang Hai orders: acceptance flow.
--
-- Payments are now AUTHORISED at checkout and captured only when the restaurant accepts
-- (or released / refunded when it rejects). The commercial status and the payment status
-- become separate columns, and orders get a short number for the counter (#1042).
--
-- SQLite cannot alter a CHECK constraint, so `orders` is rebuilt. Its children
-- (order_items, order_events) reference it with ON DELETE CASCADE, so they are rebuilt
-- too and copied BEFORE any table is dropped: no row is lost. Every existing order keeps
-- its id, token, amounts, items and history:
--   paid                      -> awaiting_acceptance + captured (accepting needs no capture;
--                                rejecting refunds it)
--   preparing/ready/completed -> same status + captured
--   failed                    -> failed + failed
--   pending/cancelled         -> same status + unpaid
--   needs_review              -> same status + (captured if Stripe had reported it paid)

PRAGMA defer_foreign_keys = true;

CREATE TABLE orders_v2 (
  id                        TEXT PRIMARY KEY,
  number                    INTEGER UNIQUE,
  token_hash                TEXT NOT NULL,
  status                    TEXT NOT NULL CHECK (status IN (
                              'pending', 'awaiting_acceptance', 'accepting', 'rejecting',
                              'preparing', 'ready', 'completed', 'rejected', 'failed',
                              'cancelled', 'needs_review')),
  payment_status            TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN (
                              'unpaid', 'processing', 'authorized', 'captured', 'canceled',
                              'failed', 'refund_pending', 'refunded', 'refund_failed')),
  storefront                TEXT NOT NULL,
  locale                    TEXT NOT NULL DEFAULT 'es' CHECK (locale IN ('es', 'en')),
  fulfillment               TEXT NOT NULL CHECK (fulfillment IN ('pickup', 'delivery')),
  catalog_id                TEXT NOT NULL,
  catalog_version           TEXT NOT NULL,
  currency                  TEXT NOT NULL DEFAULT 'EUR' CHECK (currency = 'EUR'),
  subtotal_cents            INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  delivery_fee_cents        INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_cents >= 0),
  total_cents               INTEGER NOT NULL CHECK (total_cents >= 0),
  customer_name             TEXT NOT NULL,
  customer_phone            TEXT NOT NULL,
  customer_email            TEXT NOT NULL,
  customer_notes            TEXT,
  delivery_street           TEXT,
  delivery_postal_code      TEXT,
  delivery_city             TEXT,
  delivery_notes            TEXT,
  age_confirmed             INTEGER NOT NULL DEFAULT 0 CHECK (age_confirmed IN (0, 1)),
  payments_mode             TEXT NOT NULL CHECK (payments_mode IN ('stripe-test', 'stripe-live')),
  stripe_session_id         TEXT UNIQUE,
  stripe_payment_intent_id  TEXT,
  stripe_payment_status     TEXT,
  stripe_amount_total       INTEGER,
  stripe_livemode           INTEGER,
  stripe_capture_before     TEXT,
  stripe_refund_id          TEXT,
  stripe_refund_status      TEXT,
  refund_attempts           INTEGER NOT NULL DEFAULT 0 CHECK (refund_attempts >= 0),
  prep_minutes              INTEGER CHECK (prep_minutes IS NULL OR prep_minutes BETWEEN 5 AND 180),
  rejection_reason          TEXT,
  review_reason             TEXT,
  created_at                TEXT NOT NULL,
  updated_at                TEXT NOT NULL,
  authorized_at             TEXT,
  paid_at                   TEXT,
  accepted_at               TEXT,
  ready_by                  TEXT,
  ready_at                  TEXT,
  completed_at              TEXT,
  rejected_at               TEXT
);

INSERT INTO orders_v2 (
  id, token_hash, status, payment_status, storefront, fulfillment, catalog_id, catalog_version,
  currency, subtotal_cents, delivery_fee_cents, total_cents, customer_name, customer_phone,
  customer_email, customer_notes, delivery_street, delivery_postal_code, delivery_city,
  delivery_notes, age_confirmed, payments_mode, stripe_session_id, stripe_payment_intent_id,
  stripe_payment_status, stripe_amount_total, stripe_livemode, created_at, updated_at, paid_at,
  authorized_at
)
SELECT
  id, token_hash,
  CASE status WHEN 'paid' THEN 'awaiting_acceptance' ELSE status END,
  CASE
    WHEN status IN ('paid', 'preparing', 'ready', 'completed') THEN 'captured'
    WHEN status = 'failed' THEN 'failed'
    WHEN status = 'needs_review' AND stripe_payment_status = 'paid' THEN 'captured'
    ELSE 'unpaid'
  END,
  storefront, fulfillment, catalog_id, catalog_version, currency, subtotal_cents,
  delivery_fee_cents, total_cents, customer_name, customer_phone, customer_email, customer_notes,
  delivery_street, delivery_postal_code, delivery_city, delivery_notes, age_confirmed,
  payments_mode, stripe_session_id, stripe_payment_intent_id, stripe_payment_status,
  stripe_amount_total, stripe_livemode, created_at, updated_at, paid_at, paid_at
FROM orders;

-- Counter numbers for existing orders, oldest first, starting at 1001.
UPDATE orders_v2 SET number = 1000 + (
  SELECT COUNT(*) FROM orders_v2 AS o
  WHERE o.created_at < orders_v2.created_at
     OR (o.created_at = orders_v2.created_at AND o.id <= orders_v2.id)
);

CREATE TABLE order_items_v2 (
  order_id          TEXT NOT NULL REFERENCES orders_v2 (id) ON DELETE CASCADE,
  position          INTEGER NOT NULL CHECK (position >= 0),
  item_id           TEXT NOT NULL,
  name              TEXT NOT NULL,
  options_label     TEXT,
  selections_json   TEXT NOT NULL DEFAULT '{}',
  quantity          INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents  INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  line_total_cents  INTEGER NOT NULL CHECK (line_total_cents >= 0),
  age_restricted    INTEGER NOT NULL DEFAULT 0 CHECK (age_restricted IN (0, 1)),
  PRIMARY KEY (order_id, position)
);
INSERT INTO order_items_v2 SELECT order_id, position, item_id, name, options_label, selections_json,
  quantity, unit_price_cents, line_total_cents, age_restricted FROM order_items;

CREATE TABLE order_events_v2 (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id         TEXT NOT NULL REFERENCES orders_v2 (id) ON DELETE CASCADE,
  from_status      TEXT,
  to_status        TEXT NOT NULL,
  source           TEXT NOT NULL CHECK (source IN ('checkout', 'stripe', 'staff', 'system')),
  actor            TEXT,
  stripe_event_id  TEXT,
  note             TEXT,
  created_at       TEXT NOT NULL
);
INSERT INTO order_events_v2 (id, order_id, from_status, to_status, source, actor, stripe_event_id, note, created_at)
  SELECT id, order_id, from_status, to_status, source, actor, stripe_event_id, note, created_at FROM order_events;

-- Children first: once they are gone nothing references the old orders table, so
-- dropping it cannot cascade into the copies.
DROP TABLE order_events;
DROP TABLE order_items;
DROP TABLE orders;

ALTER TABLE orders_v2 RENAME TO orders;
ALTER TABLE order_items_v2 RENAME TO order_items;
ALTER TABLE order_events_v2 RENAME TO order_events;

CREATE INDEX idx_orders_created ON orders (created_at DESC);
CREATE INDEX idx_orders_status_created ON orders (status, created_at DESC);
CREATE INDEX idx_orders_payment_intent ON orders (stripe_payment_intent_id);
CREATE INDEX idx_order_events_order ON order_events (order_id, id);

-- Outbox of staff notifications (Telegram today; Web Push can be added as a channel).
-- One row per order, channel, recipient and kind: the UNIQUE key makes duplicates impossible.
CREATE TABLE notifications (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id             TEXT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  channel              TEXT NOT NULL CHECK (channel IN ('telegram', 'webpush')),
  recipient            TEXT NOT NULL,
  kind                 TEXT NOT NULL CHECK (kind IN ('new_order', 'reminder', 'auto_cancelled', 'needs_review')),
  status               TEXT NOT NULL CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts             INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at      TEXT,
  last_error           TEXT,
  provider_message_id  TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  sent_at              TEXT,
  UNIQUE (order_id, channel, recipient, kind)
);
CREATE INDEX idx_notifications_due ON notifications (status, next_attempt_at);
CREATE INDEX idx_notifications_order ON notifications (order_id);

-- Small key/value health record: last webhook, last cron run, last delivery success/failure.
CREATE TABLE system_state (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- Staff sign-in without passwords: a 6-digit code is sent by Telegram to the authorised
-- chats; entering it opens a session stored here (only hashes are kept).
CREATE TABLE staff_login_codes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code_hash   TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  used_at     TEXT
);
CREATE INDEX idx_staff_login_codes_created ON staff_login_codes (created_at DESC);

CREATE TABLE staff_sessions (
  id            TEXT PRIMARY KEY,
  label         TEXT NOT NULL,
  method        TEXT NOT NULL CHECK (method IN ('telegram-code')),
  created_at    TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  revoked_at    TEXT
);

PRAGMA defer_foreign_keys = false;
