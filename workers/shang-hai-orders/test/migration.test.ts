import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createTestD1, MIGRATIONS } from "./d1-sqlite";

const ORDER = `INSERT INTO orders (id, token_hash, status, storefront, fulfillment, catalog_id, catalog_version,
  subtotal_cents, total_cents, customer_name, customer_phone, customer_email, payments_mode, stripe_payment_status,
  created_at, updated_at, paid_at) VALUES (?, 'h', ?, 'ink-house', 'pickup', 'shang-hai-orihuela', 'v1', 1000, 1000,
  'Ana', '+34600000000', 'a@example.es', 'stripe-test', ?, ?, ?, ?)`;

describe("migration 0002 (acceptance flow)", () => {
  it("is applied after the initial schema", () => {
    expect(MIGRATIONS).toEqual(["0001_init.sql", "0002_acceptance_flow.sql", "0003_lock_owner.sql", "0004_whatsapp_channel.sql"]);
  });

  it("keeps every existing order, line and event, mapping old statuses", () => {
    const db = createTestD1({ migrations: 1 });
    const raw = db.raw;
    const rows: [string, string, string | null, string][] = [
      ["SH-261020-AAAAAA", "paid", "paid", "2026-10-20T10:00:00.000Z"],
      ["SH-261021-BBBBBB", "preparing", "paid", "2026-10-21T10:00:00.000Z"],
      ["SH-261022-CCCCCC", "pending", null, "2026-10-22T10:00:00.000Z"],
      ["SH-261023-DDDDDD", "failed", "unpaid", "2026-10-23T10:00:00.000Z"],
      ["SH-261024-EEEEEE", "needs_review", "paid", "2026-10-24T10:00:00.000Z"],
      ["SH-261025-FFFFFF", "cancelled", null, "2026-10-25T10:00:00.000Z"],
    ];
    for (const [id, status, stripeStatus, at] of rows) {
      raw.prepare(ORDER).run(id, status, stripeStatus, at, at, stripeStatus === "paid" ? at : null);
      raw
        .prepare(
          `INSERT INTO order_items (order_id, position, item_id, name, quantity, unit_price_cents, line_total_cents)
           VALUES (?, 0, 'combo-a', 'Combo A', 1, 1000, 1000)`,
        )
        .run(id);
      raw
        .prepare(`INSERT INTO order_events (order_id, to_status, source, note, created_at) VALUES (?, ?, 'checkout', 'x', ?)`)
        .run(id, status, at);
    }

    raw.exec(readFileSync(new URL("../migrations/0002_acceptance_flow.sql", import.meta.url), "utf8"));

    const after = raw.prepare("SELECT id, number, status, payment_status, authorized_at FROM orders ORDER BY created_at").all();
    expect(after.map((r) => ({ ...r }))).toEqual([
      { id: "SH-261020-AAAAAA", number: 1001, status: "awaiting_acceptance", payment_status: "captured", authorized_at: "2026-10-20T10:00:00.000Z" },
      { id: "SH-261021-BBBBBB", number: 1002, status: "preparing", payment_status: "captured", authorized_at: "2026-10-21T10:00:00.000Z" },
      { id: "SH-261022-CCCCCC", number: 1003, status: "pending", payment_status: "unpaid", authorized_at: null },
      { id: "SH-261023-DDDDDD", number: 1004, status: "failed", payment_status: "failed", authorized_at: null },
      { id: "SH-261024-EEEEEE", number: 1005, status: "needs_review", payment_status: "captured", authorized_at: "2026-10-24T10:00:00.000Z" },
      { id: "SH-261025-FFFFFF", number: 1006, status: "cancelled", payment_status: "unpaid", authorized_at: null },
    ]);
    expect(Number((raw.prepare("SELECT COUNT(*) AS n FROM order_items").get() as { n: number }).n)).toBe(6);
    expect(Number((raw.prepare("SELECT COUNT(*) AS n FROM order_events").get() as { n: number }).n)).toBe(6);
    // Foreign keys still point at the rebuilt table (deleting an order cascades).
    expect(raw.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    raw.prepare("DELETE FROM orders WHERE id = 'SH-261025-FFFFFF'").run();
    expect(Number((raw.prepare("SELECT COUNT(*) AS n FROM order_items").get() as { n: number }).n)).toBe(5);
    // New statuses are accepted, unknown ones still refused.
    raw.prepare("UPDATE orders SET status = 'rejected', payment_status = 'refunded' WHERE id = 'SH-261020-AAAAAA'").run();
    expect(() => raw.prepare("UPDATE orders SET status = 'paid' WHERE id = 'SH-261021-BBBBBB'").run()).toThrow();
  });
});

describe("migration 0003 (lock owner)", () => {
  it("adds the lock columns to a database in use, keeping every order — including one locked by the old code", () => {
    const db = createTestD1({ migrations: 2 });
    const raw = db.raw;
    raw.exec(`INSERT INTO orders (id, number, token_hash, status, payment_status, storefront, fulfillment, catalog_id, catalog_version,
      subtotal_cents, total_cents, customer_name, customer_phone, customer_email, payments_mode, created_at, updated_at)
      VALUES ('SH-261106-STKPJ4', 1002, 'h', 'accepting', 'authorized', 'ink-house', 'pickup', 'shang-hai-orihuela', 'v1',
      4645, 4645, 'Bea', '+34600000000', 'b@example.es', 'stripe-test', '2026-11-06T10:50:26.207Z', '2026-11-06T10:57:26.484Z')`);
    raw.exec(readFileSync(new URL("../migrations/0003_lock_owner.sql", import.meta.url), "utf8"));
    expect({ ...(raw.prepare("SELECT number, status, payment_status, total_cents, lock_token, lock_expires_at FROM orders").get() as object) }).toEqual({
      number: 1002,
      status: "accepting",
      payment_status: "authorized",
      total_cents: 4645,
      lock_token: null, // a lock from before 0003: recovery treats it as expired once stale
      lock_expires_at: null,
    });
  });
});

describe("migration 0004 (WhatsApp channel)", () => {
  it("rebuilds the outbox and the sessions keeping every row and id, and accepts WhatsApp and code sessions", () => {
    const db = createTestD1({ migrations: 3 });
    const raw = db.raw;
    raw.exec(`INSERT INTO orders (id, number, token_hash, status, payment_status, storefront, fulfillment, catalog_id, catalog_version,
      subtotal_cents, total_cents, customer_name, customer_phone, customer_email, payments_mode, created_at, updated_at)
      VALUES ('SH-261106-AAAAAA', 1001, 'h', 'awaiting_acceptance', 'authorized', 'ink-house', 'pickup', 'shang-hai-orihuela', 'v1',
      1000, 1000, 'Ana', '+34600000000', 'a@example.es', 'stripe-test', '2026-11-06T10:00:00.000Z', '2026-11-06T10:00:00.000Z')`);
    raw.exec(`INSERT INTO notifications (id, order_id, channel, recipient, kind, status, attempts, created_at, updated_at, sent_at, provider_message_id)
      VALUES (7, 'SH-261106-AAAAAA', 'telegram', '111', 'new_order', 'sent', 1, '2026-11-06T10:00:01.000Z', '2026-11-06T10:00:01.000Z', '2026-11-06T10:00:01.000Z', '42')`);
    raw.exec(`INSERT INTO staff_sessions (id, label, method, created_at, last_seen_at, expires_at) VALUES ('s1', 'Móvil', 'telegram-code', 'a', 'a', 'z')`);
    raw.exec(readFileSync(new URL("../migrations/0004_whatsapp_channel.sql", import.meta.url), "utf8"));
    expect({ ...(raw.prepare("SELECT id, channel, status, sent_at, provider_message_id, delivered_at, read_at, error_code FROM notifications").get() as object) }).toEqual({
      id: 7,
      channel: "telegram",
      status: "sent",
      sent_at: "2026-11-06T10:00:01.000Z",
      provider_message_id: "42",
      delivered_at: null,
      read_at: null,
      error_code: null,
    });
    expect({ ...(raw.prepare("SELECT id, method FROM staff_sessions").get() as object) }).toEqual({ id: "s1", method: "telegram-code" });
    raw.exec(`INSERT INTO notifications (order_id, channel, recipient, kind, status, attempts, created_at, updated_at)
      VALUES ('SH-261106-AAAAAA', 'whatsapp', '34612000111', 'new_order', 'pending', 0, 'b', 'b')`);
    expect(Number((raw.prepare("SELECT MAX(id) AS n FROM notifications").get() as { n: number }).n)).toBe(8); // ids continue
    raw.exec(`INSERT INTO staff_sessions (id, label, method, created_at, last_seen_at, expires_at) VALUES ('s2', 'Móvil', 'code', 'a', 'a', 'z')`);
    expect(() => raw.exec(`UPDATE notifications SET channel = 'sms' WHERE id = 7`)).toThrow();
    expect(raw.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });
});
