-- 0004: WhatsApp (Cloud API) as an alert channel, with delivery receipts.
--
-- The notifications outbox only allowed 'telegram' and 'webpush' channels (a CHECK constraint
-- SQLite cannot alter), so the table is rebuilt keeping every row and id. New columns record
-- the delivery receipts WhatsApp sends by webhook: an alert is only "delivered" when the
-- recipient's phone confirms it (an accepted API call is not a delivery). `error_code` keeps the
-- provider's code for the panel and the retry policy. Nothing references notifications, so the
-- rebuild touches no other table.
CREATE TABLE notifications_v2 (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id             TEXT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  channel              TEXT NOT NULL CHECK (channel IN ('whatsapp', 'telegram', 'webpush')),
  recipient            TEXT NOT NULL,
  kind                 TEXT NOT NULL CHECK (kind IN ('new_order', 'reminder', 'auto_cancelled', 'needs_review')),
  status               TEXT NOT NULL CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts             INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at      TEXT,
  last_error           TEXT,
  error_code           TEXT,
  provider_message_id  TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  sent_at              TEXT,
  delivered_at         TEXT,
  read_at              TEXT,
  UNIQUE (order_id, channel, recipient, kind)
);

INSERT INTO notifications_v2 (id, order_id, channel, recipient, kind, status, attempts, next_attempt_at, last_error,
                              provider_message_id, created_at, updated_at, sent_at)
  SELECT id, order_id, channel, recipient, kind, status, attempts, next_attempt_at, last_error,
         provider_message_id, created_at, updated_at, sent_at
    FROM notifications;

DROP TABLE notifications;
ALTER TABLE notifications_v2 RENAME TO notifications;

CREATE INDEX idx_notifications_due ON notifications (status, next_attempt_at);
CREATE INDEX idx_notifications_order ON notifications (order_id);
-- Status webhooks find their alert by the provider's message id (wamid).
CREATE INDEX idx_notifications_provider ON notifications (channel, provider_message_id);

-- Staff sessions opened with a one-time code: the code may now arrive by WhatsApp or Telegram,
-- so new sessions record the generic method 'code' (older rows keep 'telegram-code').
CREATE TABLE staff_sessions_v2 (
  id            TEXT PRIMARY KEY,
  label         TEXT NOT NULL,
  method        TEXT NOT NULL CHECK (method IN ('telegram-code', 'code')),
  created_at    TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  revoked_at    TEXT
);
INSERT INTO staff_sessions_v2 (id, label, method, created_at, last_seen_at, expires_at, revoked_at)
  SELECT id, label, method, created_at, last_seen_at, expires_at, revoked_at FROM staff_sessions;
DROP TABLE staff_sessions;
ALTER TABLE staff_sessions_v2 RENAME TO staff_sessions;
