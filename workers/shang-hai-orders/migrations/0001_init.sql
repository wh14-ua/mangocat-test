-- Shang Hai orders: initial schema.
-- Amounts are integer cents (EUR). No card data is ever stored: payment details stay
-- with Stripe; we keep only Stripe identifiers needed for reconciliation.

CREATE TABLE IF NOT EXISTS orders (
  id                        TEXT PRIMARY KEY,
  token_hash                TEXT NOT NULL,
  status                    TEXT NOT NULL CHECK (status IN (
                              'pending', 'paid', 'failed', 'cancelled',
                              'preparing', 'ready', 'completed', 'needs_review')),
  storefront                TEXT NOT NULL,
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
  created_at                TEXT NOT NULL,
  updated_at                TEXT NOT NULL,
  paid_at                   TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders (status, created_at DESC);

-- Each line keeps the unit price confirmed at purchase time.
CREATE TABLE IF NOT EXISTS order_items (
  order_id          TEXT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
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

-- Audit trail of every status change (checkout, Stripe webhook or staff).
CREATE TABLE IF NOT EXISTS order_events (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id         TEXT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  from_status      TEXT,
  to_status        TEXT NOT NULL,
  source           TEXT NOT NULL CHECK (source IN ('checkout', 'stripe', 'staff', 'system')),
  actor            TEXT,
  stripe_event_id  TEXT,
  note             TEXT,
  created_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events (order_id, id);

-- Webhook idempotency: one row per Stripe event id.
CREATE TABLE IF NOT EXISTS stripe_events (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL,
  livemode      INTEGER NOT NULL CHECK (livemode IN (0, 1)),
  order_id      TEXT,
  status        TEXT NOT NULL CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
  received_at   TEXT NOT NULL,
  processed_at  TEXT
);
