import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createTestD1, MIGRATIONS } from "./d1-sqlite";

const ORDER = `INSERT INTO orders (id, token_hash, status, storefront, fulfillment, catalog_id, catalog_version,
  subtotal_cents, total_cents, customer_name, customer_phone, customer_email, payments_mode, stripe_payment_status,
  created_at, updated_at, paid_at) VALUES (?, 'h', ?, 'ink-house', 'pickup', 'shang-hai-orihuela', 'v1', 1000, 1000,
  'Ana', '+34600000000', 'a@example.es', 'stripe-test', ?, ?, ?, ?)`;

describe("migration 0002 (acceptance flow)", () => {
  it("is applied after the initial schema", () => {
    expect(MIGRATIONS).toEqual(["0001_init.sql", "0002_acceptance_flow.sql"]);
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
