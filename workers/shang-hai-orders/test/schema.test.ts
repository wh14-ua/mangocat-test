import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { REQUIRED_SCHEMA } from "../src/schema.generated";
import { missingFromRows } from "../src/schema";
// Shared with the CLI (npm run db:check / db:verify) and the local demo.
import {
  columnDefinitions,
  describeDrift,
  diffSchema,
  expectedSchema,
  hasDrift,
  migrationHash,
  readMigrationFiles,
  repairPlan,
  requiredShape,
  schemaOfDatabase,
  verifyLock,
} from "../../../scripts/db/schema-tools.mjs";
import { generatedSource, readLock } from "../../../scripts/db/schema.mjs";
import { createTestD1 } from "./d1-sqlite";
import { call, makeDeps, makeEnv, fakeNetwork, staffCookie, type TestEnv } from "./helpers";

/**
 * Bug A of the 2026-11-06 demo: `wrangler d1 migrations apply` said "No migrations to apply"
 * but the Worker failed with "D1_ERROR: no such column: staff_seen_at". The local database had
 * applied migration 0002 on 2026-11-05 at 09:35; at 18:09 the same file was edited to add
 * `staff_seen_at` (commit 6c8bff8). Wrangler records migrations by file name only, so the
 * edit never reached that database. The fixture is 0002 exactly as that database applied it.
 */
const MIGRATIONS_DIR = new URL("../migrations/", import.meta.url).pathname;
const OLD_0002 = readFileSync(new URL("./fixtures/0002_acceptance_flow.rev-9bffa95.sql", import.meta.url), "utf8");
const INIT = readFileSync(new URL("../migrations/0001_init.sql", import.meta.url), "utf8");
/** Every migration after 0002, applied normally (wrangler applies new files by name). */
const LATER = Object.entries(readMigrationFiles(MIGRATIONS_DIR))
  .filter(([name]) => name >= "0003")
  .map(([, text]) => text);

/** A database migrated with the historical revision of 0002 (what the demo laptop had). */
function driftedDatabase(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(INIT);
  db.exec(OLD_0002);
  for (const text of LATER) db.exec(text);
  return db;
}

describe("migrations are immutable once recorded", () => {
  it("every migration on disk matches migrations.lock.json", () => {
    expect(verifyLock(readMigrationFiles(MIGRATIONS_DIR), readLock())).toEqual([]);
  });

  it("would have caught the in-place edit of 0002 that caused the demo failure", () => {
    const lockedAtFirstCommit = { migrations: { ...readLock().migrations, "0002_acceptance_flow.sql": migrationHash(OLD_0002) } };
    const problems = verifyLock(readMigrationFiles(MIGRATIONS_DIR), lockedAtFirstCommit);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ kind: "modified", name: "0002_acceptance_flow.sql" });
  });

  it("flags a new migration that is not locked and a locked one that disappeared", () => {
    const files = readMigrationFiles(MIGRATIONS_DIR);
    const problems = verifyLock({ ...files, "0003_new.sql": "SELECT 1;" }, { migrations: { ...readLock().migrations, "0009_gone.sql": "x" } });
    expect(problems.map((p) => p.kind).sort()).toEqual(["missing", "unlocked"]);
  });

  it("ignores line-ending differences (Windows checkouts)", () => {
    expect(migrationHash("a\r\nb\r\n")).toBe(migrationHash("a\nb\n"));
  });
});

describe("the schema the Worker requires", () => {
  it("is exactly what the migrations produce (src/schema.generated.ts is up to date)", () => {
    expect(requiredShape(expectedSchema(MIGRATIONS_DIR))).toEqual(JSON.parse(JSON.stringify(REQUIRED_SCHEMA)));
    expect(readFileSync(new URL("../src/schema.generated.ts", import.meta.url), "utf8")).toBe(generatedSource());
  });

  it("a fresh database built from the migrations has no drift", () => {
    const db = new DatabaseSync(":memory:");
    for (const text of Object.values(readMigrationFiles(MIGRATIONS_DIR))) db.exec(text);
    expect(hasDrift(diffSchema(expectedSchema(MIGRATIONS_DIR), schemaOfDatabase(db)))).toBe(false);
  });
});

describe("drift detection (reproduces the demo database)", () => {
  it("finds the column the old revision of 0002 lacked — and nothing else", () => {
    const drift = diffSchema(expectedSchema(MIGRATIONS_DIR), schemaOfDatabase(driftedDatabase()));
    expect(describeDrift(drift)).toEqual(["missing column orders.staff_seen_at"]);
  });

  it("repairs it additively with the exact definition, keeping every row", () => {
    const db = driftedDatabase();
    db.exec(`INSERT INTO orders (id, number, token_hash, status, payment_status, storefront, fulfillment, catalog_id, catalog_version,
      subtotal_cents, total_cents, customer_name, customer_phone, customer_email, payments_mode, created_at, updated_at)
      VALUES ('SH-261106-STKPJ4', 1002, 'h', 'accepting', 'authorized', 'ink-house', 'pickup', 'shang-hai-orihuela', 'v1',
      4645, 4645, 'Bea', '+34600000000', 'b@example.es', 'stripe-test', '2026-11-06T10:50:26.207Z', '2026-11-06T10:57:26.484Z')`);
    const expected = expectedSchema(MIGRATIONS_DIR);
    const plan = repairPlan(expected, diffSchema(expected, schemaOfDatabase(db)));
    expect(plan).toEqual({ statements: ["ALTER TABLE orders ADD COLUMN staff_seen_at TEXT;"], blocked: [] });
    for (const s of plan.statements) db.exec(s);
    expect(hasDrift(diffSchema(expected, schemaOfDatabase(db)))).toBe(false);
    expect(db.prepare("SELECT number, status, total_cents, staff_seen_at FROM orders").all().map((r) => ({ ...r }))).toEqual([
      { number: 1002, status: "accepting", total_cents: 4645, staff_seen_at: null },
    ]);
  });

  it("never 'repairs' what would need a table rebuild (changed type / NOT NULL) or lose constraints", () => {
    const expected = expectedSchema(MIGRATIONS_DIR);
    const db = new DatabaseSync(":memory:");
    for (const text of Object.values(readMigrationFiles(MIGRATIONS_DIR))) db.exec(text);
    db.exec("CREATE TABLE system_state_tmp (key TEXT, value TEXT, updated_at TEXT); DROP TABLE system_state; ALTER TABLE system_state_tmp RENAME TO system_state;");
    const drift = diffSchema(expected, schemaOfDatabase(db));
    expect(hasDrift(drift)).toBe(true);
    const plan = repairPlan(expected, drift);
    expect(plan.blocked.length).toBeGreaterThan(0);
  });

  it("recreates missing tables and indexes exactly as the migrations define them", () => {
    const expected = expectedSchema(MIGRATIONS_DIR);
    const db = new DatabaseSync(":memory:");
    for (const text of Object.values(readMigrationFiles(MIGRATIONS_DIR))) db.exec(text);
    db.exec("DROP INDEX idx_notifications_due; DROP TABLE staff_sessions;");
    const plan = repairPlan(expected, diffSchema(expected, schemaOfDatabase(db)));
    expect(plan.blocked).toEqual([]);
    for (const s of plan.statements) db.exec(s);
    expect(hasDrift(diffSchema(expected, schemaOfDatabase(db)))).toBe(false);
  });

  it("reads column definitions from CREATE TABLE text with comments, quotes and CHECK lists", () => {
    const defs = columnDefinitions(`CREATE TABLE "t" (
      -- a comment, with a comma
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL CHECK (status IN ('a', 'b,c')), /* inline, comment */
      "quoted name" INTEGER DEFAULT 0,
      PRIMARY KEY (id),
      CHECK (id <> '')
    )`);
    expect(defs).toEqual({
      id: "id TEXT PRIMARY KEY",
      status: "status TEXT NOT NULL CHECK (status IN ('a', 'b,c'))",
      "quoted name": '"quoted name" INTEGER DEFAULT 0',
    });
  });
});

describe("the Worker on an outdated database", () => {
  /** The demo database: old 0002, with an order waiting for the restaurant. */
  function driftedEnv(): TestEnv {
    const d1 = createTestD1({ migrations: 0 });
    d1.raw.exec(INIT);
    d1.raw.exec(OLD_0002);
    for (const text of LATER) d1.raw.exec(text);
    d1.raw.exec(`INSERT INTO orders (id, number, token_hash, status, payment_status, storefront, fulfillment, catalog_id, catalog_version,
      subtotal_cents, total_cents, customer_name, customer_phone, customer_email, payments_mode, created_at, updated_at, authorized_at)
      VALUES ('SH-261106-STKPJ4', 1002, 'h', 'awaiting_acceptance', 'authorized', 'ink-house', 'pickup', 'shang-hai-orihuela', 'v1',
      4645, 4645, 'Bea', '+34600000000', 'b@example.es', 'stripe-test', '2026-11-06T10:50:26.207Z', '2026-11-06T10:50:30.102Z', '2026-11-06T10:50:30.102Z')`);
    return makeEnv({ DB: d1 });
  }

  it("lists exactly what is missing", async () => {
    const env = driftedEnv();
    const rows = env.DB.raw
      .prepare(
        `SELECT m.type AS type, m.name AS name, p.name AS col FROM sqlite_master m LEFT JOIN pragma_table_info(m.name) p ON m.type = 'table'
          WHERE m.type IN ('table', 'index') AND m.name NOT LIKE 'sqlite_%'`,
      )
      .all() as { type: string; name: string; col: string | null }[];
    expect(missingFromRows(rows)).toEqual(["column orders.staff_seen_at"]);
  });

  it("answers 503 schema-outdated (not a D1_ERROR 500) on the panel, the API, the webhook and health", async () => {
    const env = driftedEnv();
    const deps = makeDeps(fakeNetwork().fetch);
    const cookie = await staffCookie(env);
    const board = await call(env, deps, "/api/admin/board", { headers: { Cookie: cookie } });
    expect(board.status).toBe(503);
    expect(await board.json()).toMatchObject({ error: "schema-outdated" });

    const health = await call(env, deps, "/api/health");
    expect(health.status).toBe(503);
    expect(await health.json()).toEqual({ ok: false, schema: "outdated" });

    const webhook = await call(env, deps, "/api/stripe/webhook", { method: "POST", body: "{}" });
    expect(webhook.status).toBe(503); // Stripe retries later: nothing is lost

    // The storefront config needs no database and keeps working.
    expect((await call(env, deps, "/api/config")).status).toBe(200);
  });

  it("works again as soon as the database is repaired (no restart needed)", async () => {
    const env = driftedEnv();
    let clock = Date.parse("2026-11-06T11:00:00Z");
    const deps = makeDeps(fakeNetwork().fetch, () => new Date(clock));
    const { verifySchema } = await import("../src/schema");
    expect((await verifySchema(env.DB, clock)).ok).toBe(false);
    env.DB.raw.exec("ALTER TABLE orders ADD COLUMN staff_seen_at TEXT;");
    clock += 31_000;
    expect((await verifySchema(env.DB, clock)).ok).toBe(true);
    void deps;
  });
});
