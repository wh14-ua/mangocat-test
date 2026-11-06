import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { checkLocalDatabase, queryD1, WORKER_DIR } from "../../../scripts/db/schema.mjs";
import { suiteStack, tempStateDir } from "./stack-client";

/**
 * Migrations with the real tooling (wrangler + the local D1 that workerd uses): fresh and
 * existing databases, no data lost, the demo's drift (bug A) reproduced end to end, a
 * migration that fails half-way, and the Worker's own schema guard inside workerd.
 */

const WRANGLER = join(WORKER_DIR, "node_modules/wrangler/bin/wrangler.js");
const MIGRATIONS = readdirSync(join(WORKER_DIR, "migrations")).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
const OLD_0002 = readFileSync(join(WORKER_DIR, "test/fixtures/0002_acceptance_flow.rev-9bffa95.sql"), "utf8");
const cleanup: string[] = [];

afterAll(() => {
  for (const dir of cleanup) rmSync(dir, { recursive: true, force: true });
});

function state(name: string) {
  const dir = tempStateDir(name);
  cleanup.push(dir);
  return dir;
}

/** A copy of the Worker's wrangler config with a custom migrations folder (historical revisions). */
function workerWith(migrations: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "shanghai-worker-"));
  cleanup.push(dir);
  cpSync(join(WORKER_DIR, "wrangler.jsonc"), join(dir, "wrangler.jsonc"));
  mkdirSync(join(dir, "migrations"));
  for (const [name, text] of Object.entries(migrations)) writeFileSync(join(dir, "migrations", name), text);
  return dir;
}

function apply(persistTo: string, cwd = WORKER_DIR) {
  const res = spawnSync(process.execPath, [WRANGLER, "d1", "migrations", "apply", "shang-hai-orders", "--local", "--persist-to", persistTo], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false", FORCE_COLOR: "0" },
  });
  return { status: res.status, out: `${res.stdout}\n${res.stderr}` };
}

const real = (name: string) => readFileSync(join(WORKER_DIR, "migrations", name), "utf8");
const ORDER = (id: string, number: number, status: string) =>
  `INSERT INTO orders (id, number, token_hash, status, storefront, fulfillment, catalog_id, catalog_version, subtotal_cents, total_cents,
     customer_name, customer_phone, customer_email, payments_mode, created_at, updated_at)
   VALUES ('${id}', ${number}, 'h', '${status}', 'ink-house', 'pickup', 'shang-hai-orihuela', 'v1', 4645, 4645, 'Bea', '+34600000000',
     'b@example.es', 'stripe-test', '2026-11-05T08:40:00.000Z', '2026-11-05T08:40:00.000Z')`;

function execute(persistTo: string, sql: string) {
  const res = spawnSync(process.execPath, [WRANGLER, "d1", "execute", "shang-hai-orders", "--local", "--persist-to", persistTo, "--command", sql], {
    cwd: WORKER_DIR,
    encoding: "utf8",
    env: { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false", FORCE_COLOR: "0" },
  });
  if (res.status !== 0) throw new Error(res.stderr || res.stdout);
}

describe("migrations on the real local D1", () => {
  it("K/L: a fresh database gets exactly the schema the migrations define", () => {
    const db = state("fresh");
    const res = apply(db);
    expect(res.status).toBe(0);
    for (const m of MIGRATIONS) expect(res.out).toContain(m);
    expect(checkLocalDatabase({ persistTo: db })).toMatchObject({ ok: true });
    expect(apply(db).out).toMatch(/No migrations to apply/);
  }, 120_000);

  it("J/M: an existing database (0001 with orders) is migrated keeping every order", () => {
    const db = state("existing");
    const worker = workerWith({ "0001_init.sql": real("0001_init.sql") });
    expect(apply(db, worker).status).toBe(0);
    // An order paid under the very first schema (no number, no payment_status yet).
    execute(
      db,
      `INSERT INTO orders (id, token_hash, status, storefront, fulfillment, catalog_id, catalog_version, subtotal_cents, total_cents,
         customer_name, customer_phone, customer_email, payments_mode, stripe_payment_status, created_at, updated_at, paid_at)
       VALUES ('SH-261105-AAAAAA', 'h', 'paid', 'ink-house', 'pickup', 'shang-hai-orihuela', 'v1', 1000, 1000, 'Ana', '+34600000000',
         'a@example.es', 'stripe-test', 'paid', '2026-10-20T10:00:00.000Z', '2026-10-20T10:00:00.000Z', '2026-10-20T10:00:00.000Z')`,
    );
    const res = apply(db);
    expect(res.status).toBe(0);
    expect(checkLocalDatabase({ persistTo: db })).toMatchObject({ ok: true });
    const rows = queryD1("SELECT id, status, payment_status, lock_token FROM orders", { persistTo: db });
    expect(rows).toEqual([{ id: "SH-261105-AAAAAA", status: "awaiting_acceptance", payment_status: "captured", lock_token: null }]);
  }, 120_000);

  it("bug A end to end: a database that applied the old 0002 is detected and repaired, data kept", () => {
    const db = state("drift");
    const old = workerWith({ "0001_init.sql": real("0001_init.sql"), "0002_acceptance_flow.sql": OLD_0002 });
    expect(apply(db, old).status).toBe(0); // the demo laptop, 2026-11-05 09:35
    execute(db, ORDER("SH-261106-STKPJ4", 1002, "awaiting_acceptance"));

    // Today's migrations: wrangler only sees the files it has not recorded (0003+), never 0002's edit.
    const res = apply(db);
    expect(res.status).toBe(0);
    expect(res.out).not.toMatch(/0002_acceptance_flow\.sql\s*│\s*✅/);
    const check = checkLocalDatabase({ persistTo: db });
    expect(check.ok).toBe(false);
    expect(check.problems).toEqual(["missing column orders.staff_seen_at"]);

    const repaired = checkLocalDatabase({ persistTo: db, repair: true, log: () => undefined });
    expect(repaired).toMatchObject({ ok: true, repaired: true, statements: ["ALTER TABLE orders ADD COLUMN staff_seen_at TEXT;"] });
    expect(repaired.backup && existsSync(repaired.backup)).toBe(true);
    expect(queryD1("SELECT number, status FROM orders", { persistTo: db })).toEqual([{ number: 1002, status: "awaiting_acceptance" }]);
  }, 180_000);

  it("I: a migration that fails half-way leaves no trace and can be fixed and re-applied", () => {
    const db = state("broken");
    const files = Object.fromEntries(MIGRATIONS.map((m) => [m, real(m)]));
    const broken = workerWith({ ...files, "0099_broken.sql": "CREATE TABLE half_done (id INTEGER);\nINSERT INTO no_such_table VALUES (1);\n" });
    const res = apply(db, broken);
    expect(res.status).not.toBe(0);
    expect(queryD1("SELECT name FROM sqlite_master WHERE name = 'half_done'", { persistTo: db })).toEqual([]);
    expect(queryD1("SELECT name FROM d1_migrations WHERE name = '0099_broken.sql'", { persistTo: db })).toEqual([]);
    const fixed = workerWith({ ...files, "0099_broken.sql": "CREATE TABLE half_done (id INTEGER);\n" });
    expect(apply(db, fixed).status).toBe(0);
    expect(queryD1("SELECT name FROM sqlite_master WHERE name = 'half_done'", { persistTo: db })).toEqual([{ name: "half_done" }]);
  }, 180_000);
});

describe("the Worker's schema guard inside workerd", () => {
  it("answers 503 schema-outdated on a drifted database, and serves again once it is repaired", async () => {
    const stack = suiteStack("guard", 8900);
    cleanup.push(stack.stateDir);
    const old = workerWith({ "0001_init.sql": real("0001_init.sql"), "0002_acceptance_flow.sql": OLD_0002 });
    expect(apply(stack.stateDir, old).status).toBe(0);
    expect(apply(stack.stateDir).status).toBe(0);
    try {
      await stack.startCloud();
      await stack.startWorker();
      const health = await fetch(`${stack.urls.worker}/api/health`);
      expect(health.status).toBe(503);
      expect(await health.json()).toEqual({ ok: false, schema: "outdated" });
      expect(stack.logs.worker.join("\n")).toMatch(/schema\.outdated.*orders\.staff_seen_at/);
      await stack.stopWorker();
      expect(checkLocalDatabase({ persistTo: stack.stateDir, repair: true, log: () => undefined }).ok).toBe(true);
      await stack.startWorker();
      const after = await fetch(`${stack.urls.worker}/api/health`);
      expect(after.status).toBe(200);
    } finally {
      await stack.stopAll();
    }
  }, 180_000);
});
