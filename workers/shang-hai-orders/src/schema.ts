import type { D1Like } from "./env";
import { log } from "./log";
import { REQUIRED_SCHEMA } from "./schema.generated";

/**
 * Refuses to run on a database that lacks part of the schema the code needs.
 *
 * A database can be "migrated" by wrangler's account (every migration file name recorded)
 * and still miss columns — e.g. when a migration was edited after it had been applied —
 * which surfaced as "D1_ERROR: no such column: staff_seen_at" in the middle of a demo. The
 * Worker now checks once per isolate and answers 503 `schema-outdated` (and logs exactly
 * what is missing) instead of failing half-way through an order or a payment.
 */

const QUERY = `WITH objects AS (
  SELECT type, name FROM sqlite_master
   WHERE type IN ('table', 'index') AND substr(name, 1, 7) <> 'sqlite_' AND substr(name, 1, 4) <> '_cf_'
)
SELECT o.type AS type, o.name AS name, p.name AS col
  FROM objects o LEFT JOIN pragma_table_info(o.name) p ON o.type = 'table'`;

export type SchemaReport = { ok: true; verified: boolean } | { ok: false; missing: string[] };

type Row = { type: string; name: string; col: string | null };

export function missingFromRows(rows: Row[]): string[] {
  const tables = new Map<string, Set<string>>();
  const indexes = new Set<string>();
  for (const r of rows) {
    if (r.type === "table") {
      const cols = tables.get(r.name) ?? new Set<string>();
      if (r.col) cols.add(r.col);
      tables.set(r.name, cols);
    } else if (r.type === "index") {
      indexes.add(r.name);
    }
  }
  const missing: string[] = [];
  for (const [table, columns] of Object.entries(REQUIRED_SCHEMA.tables)) {
    const have = tables.get(table);
    if (!have) {
      missing.push(`table ${table}`);
      continue;
    }
    for (const c of columns) if (!have.has(c)) missing.push(`column ${table}.${c}`);
  }
  for (const i of REQUIRED_SCHEMA.indexes) if (!indexes.has(i)) missing.push(`index ${i}`);
  return missing;
}

/** A confirmed problem is re-checked after this long (migrations may be applied meanwhile). */
const RECHECK_OUTDATED_MS = 30_000;

const cache = new WeakMap<D1Like, { report: Promise<SchemaReport>; at: number }>();

async function inspect(db: D1Like): Promise<SchemaReport> {
  const { results } = await db.prepare(QUERY).all<Row>();
  const missing = missingFromRows(results);
  if (missing.length) {
    log("schema.outdated", { missing: missing.join(", ") });
    return { ok: false, missing };
  }
  return { ok: true, verified: true };
}

/**
 * Cached per database binding: a good schema is checked once per isolate, a bad one again
 * every 30 s. If the check itself cannot run, requests are let through (and the failure is
 * logged): the guard must never become the outage.
 */
export async function verifySchema(db: D1Like, now = Date.now()): Promise<SchemaReport> {
  const hit = cache.get(db);
  if (hit) {
    const report = await hit.report;
    if (report.ok || now - hit.at <= RECHECK_OUTDATED_MS) return report;
  }
  return recheck(db, now);
}

function recheck(db: D1Like, now: number): Promise<SchemaReport> {
  const report = inspect(db).catch((error: unknown) => {
    cache.delete(db);
    log("schema.check-failed", { message: error instanceof Error ? error.message : "unknown" });
    return { ok: true, verified: false } as SchemaReport;
  });
  cache.set(db, { report, at: now });
  return report;
}
