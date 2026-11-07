// Schema tooling for the order database (D1 / SQLite), shared by the CLI (scripts/db/schema.mjs),
// the local demo (scripts/local-stack/run.mjs) and the test suites.
//
// Why it exists (2026-11-06 demo): a migration was edited after a local database had already
// applied it. Wrangler records migrations by file name only, so it reported "No migrations to
// apply" while the database lacked a column the code used (`no such column: staff_seen_at`).
// Two defences:
//   1. migrations.lock.json pins the SHA-256 of every migration: an applied migration can never
//      be edited silently again (the test suite and CI fail).
//   2. Drift detection compares a real database with the schema the migrations produce, before
//      a demo starts (and in the pre-deploy check), and repairs local test databases safely.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const MIGRATION_FILE = /^\d{4}_[a-z0-9_]+\.sql$/;

export function listMigrations(dir) {
  return readdirSync(dir)
    .filter((f) => MIGRATION_FILE.test(f))
    .sort();
}

/** Content hash of a migration, independent of the checkout's line endings. */
export function migrationHash(text) {
  return createHash("sha256").update(String(text).replace(/\r\n/g, "\n")).digest("hex");
}

/**
 * Compares the migrations on disk with the lock. Returns a list of problems (empty = fine).
 * `files` maps file name -> content (so tests can feed historical revisions).
 */
export function verifyLock(files, lock) {
  const problems = [];
  const locked = lock?.migrations ?? {};
  for (const [name, text] of Object.entries(files)) {
    if (!(name in locked)) {
      problems.push({ kind: "unlocked", name, message: `${name} is not recorded in migrations.lock.json (run: npm run db:lock)` });
    } else if (locked[name] !== migrationHash(text)) {
      problems.push({
        kind: "modified",
        name,
        message: `${name} changed after it was recorded. Databases that already applied it will NOT get the change (wrangler tracks file names only). Restore it and put the change in a new migration.`,
      });
    }
  }
  for (const name of Object.keys(locked)) {
    if (!(name in files)) problems.push({ kind: "missing", name, message: `${name} is recorded in the lock but the file is gone` });
  }
  return problems;
}

export function readMigrationFiles(dir) {
  return Object.fromEntries(listMigrations(dir).map((f) => [f, readFileSync(join(dir, f), "utf8")]));
}

/**
 * One query that describes the schema, valid on node:sqlite and on D1 (pragma table-valued
 * functions are allowed there). Internal tables (sqlite_*, Cloudflare's _cf_*, wrangler's
 * d1_migrations) are filtered out first.
 */
export const INTROSPECT_SQL = `WITH objects AS (
  SELECT type, name, tbl_name, sql FROM sqlite_master
   WHERE type IN ('table', 'index', 'trigger', 'view')
     AND substr(name, 1, 7) <> 'sqlite_' AND substr(name, 1, 4) <> '_cf_' AND name <> 'd1_migrations'
)
SELECT o.type AS type, o.name AS name, o.tbl_name AS tbl, o.sql AS sql,
       p.cid AS cid, p.name AS col, p.type AS coltype, p."notnull" AS nn, p.dflt_value AS dflt, p.pk AS pk
  FROM objects o LEFT JOIN pragma_table_info(o.name) p ON o.type = 'table'
 ORDER BY o.type, o.name, p.cid`;

/** Rows of INTROSPECT_SQL -> { tables, indexes, triggers, views }. */
export function schemaFromRows(rows) {
  const schema = { tables: {}, indexes: {}, triggers: {}, views: {} };
  for (const r of rows) {
    if (r.type === "table") {
      const t = (schema.tables[r.name] ??= { sql: r.sql, columns: [] });
      if (r.col !== null && r.col !== undefined) {
        t.columns.push({
          name: r.col,
          type: String(r.coltype ?? "").toUpperCase(),
          notnull: Number(r.nn) === 1,
          dflt: r.dflt ?? null,
          pk: Number(r.pk ?? 0),
        });
      }
    } else if (r.type === "index") {
      // Automatic indexes (UNIQUE / PRIMARY KEY constraints) have no SQL and are part of the table.
      if (r.sql) schema.indexes[r.name] = { table: r.tbl, sql: r.sql };
    } else if (r.type === "trigger") {
      schema.triggers[r.name] = { table: r.tbl, sql: r.sql };
    } else if (r.type === "view") {
      schema.views[r.name] = { sql: r.sql };
    }
  }
  return schema;
}

/** The schema that applying every migration to an empty database produces. */
export function expectedSchema(migrationsDir) {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of listMigrations(migrationsDir)) db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  const schema = schemaFromRows(db.prepare(INTROSPECT_SQL).all());
  db.close();
  return schema;
}

/** Introspects an open node:sqlite database. */
export function schemaOfDatabase(db) {
  return schemaFromRows(db.prepare(INTROSPECT_SQL).all());
}

const normalizeDefault = (d) => (d === null || d === undefined ? null : String(d).trim());

/**
 * What the actual schema lacks or has different from the expected one. Extra tables,
 * columns or indexes are reported separately (informational: never a failure).
 */
export function diffSchema(expected, actual) {
  const drift = { missingTables: [], missingColumns: [], changedColumns: [], missingIndexes: [], missingTriggers: [], missingViews: [], extra: [] };
  for (const [name, table] of Object.entries(expected.tables)) {
    const real = actual.tables[name];
    if (!real) {
      drift.missingTables.push(name);
      continue;
    }
    const realCols = new Map(real.columns.map((c) => [c.name, c]));
    for (const col of table.columns) {
      const got = realCols.get(col.name);
      if (!got) {
        drift.missingColumns.push({ table: name, column: col.name });
        continue;
      }
      const differences = [];
      if (got.type !== col.type) differences.push(`type ${got.type || "(none)"} ≠ ${col.type || "(none)"}`);
      if (got.notnull !== col.notnull) differences.push(got.notnull ? "NOT NULL where none is expected" : "missing NOT NULL");
      if (normalizeDefault(got.dflt) !== normalizeDefault(col.dflt)) differences.push(`default ${got.dflt ?? "NULL"} ≠ ${col.dflt ?? "NULL"}`);
      if (got.pk !== col.pk) differences.push("primary key differs");
      if (differences.length) drift.changedColumns.push({ table: name, column: col.name, differences });
    }
    for (const c of real.columns) if (!table.columns.some((e) => e.name === c.name)) drift.extra.push(`column ${name}.${c.name}`);
  }
  for (const name of Object.keys(actual.tables)) if (!expected.tables[name]) drift.extra.push(`table ${name}`);
  for (const name of Object.keys(expected.indexes)) if (!actual.indexes[name]) drift.missingIndexes.push(name);
  for (const name of Object.keys(expected.triggers)) if (!actual.triggers[name]) drift.missingTriggers.push(name);
  for (const name of Object.keys(expected.views)) if (!actual.views[name]) drift.missingViews.push(name);
  return drift;
}

export function hasDrift(drift) {
  return (
    drift.missingTables.length + drift.missingColumns.length + drift.changedColumns.length + drift.missingIndexes.length + drift.missingTriggers.length + drift.missingViews.length > 0
  );
}

export function describeDrift(drift) {
  const lines = [];
  for (const t of drift.missingTables) lines.push(`missing table ${t}`);
  for (const c of drift.missingColumns) lines.push(`missing column ${c.table}.${c.column}`);
  for (const c of drift.changedColumns) lines.push(`column ${c.table}.${c.column} differs: ${c.differences.join(", ")}`);
  for (const i of drift.missingIndexes) lines.push(`missing index ${i}`);
  for (const i of drift.missingTriggers) lines.push(`missing trigger ${i}`);
  for (const i of drift.missingViews) lines.push(`missing view ${i}`);
  return lines;
}

// ---------------------------------------------------------------------------
// Safe, additive repair (local test databases only)
// ---------------------------------------------------------------------------

/** Strips -- and /* *\/ comments outside string literals. */
function stripComments(sql) {
  let out = "";
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'" || ch === '"' || ch === "`") {
      const end = sql.indexOf(ch, i + 1);
      const stop = end === -1 ? sql.length : end;
      out += sql.slice(i, stop + 1);
      i = stop;
    } else if (ch === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      out += "\n";
    } else if (ch === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 1;
      out += " ";
    } else {
      out += ch;
    }
  }
  return out;
}

/** Column definitions of a CREATE TABLE statement, by column name (table constraints excluded). */
export function columnDefinitions(createTableSql) {
  const sql = stripComments(createTableSql);
  const open = sql.indexOf("(");
  if (open === -1) return {};
  const parts = [];
  let depth = 0;
  let current = "";
  for (let i = open + 1; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'" || ch === '"' || ch === "`") {
      const end = sql.indexOf(ch, i + 1);
      const stop = end === -1 ? sql.length - 1 : end;
      current += sql.slice(i, stop + 1);
      i = stop;
      continue;
    }
    if (ch === "(") depth++;
    if (ch === ")") {
      if (depth === 0) {
        parts.push(current);
        break;
      }
      depth--;
    }
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  const defs = {};
  for (const raw of parts) {
    const def = raw.replace(/\s+/g, " ").trim();
    if (!def) continue;
    const name = /^(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([A-Za-z_][A-Za-z0-9_]*))/.exec(def);
    if (!name) continue;
    const ident = name[1] ?? name[2] ?? name[3] ?? name[4];
    if (/^(constraint|primary|unique|check|foreign)$/i.test(ident) && !name[1]) continue;
    defs[ident] = def;
  }
  return defs;
}

/** Why SQLite's ALTER TABLE ADD COLUMN cannot add this column as defined (null = it can). */
function addColumnBlocker(def) {
  if (/\bprimary\s+key\b/i.test(def)) return "PRIMARY KEY column";
  if (/\bunique\b/i.test(def)) return "UNIQUE column";
  if (/\bdefault\s*\(/i.test(def)) return "default is an expression";
  if (/\bdefault\s+current_(time|date|timestamp)\b/i.test(def)) return "default is CURRENT_TIME/DATE/TIMESTAMP";
  if (/\bnot\s+null\b/i.test(def) && !/\bdefault\b/i.test(def)) return "NOT NULL without a default";
  if (/\bgenerated\b/i.test(def) && /\bstored\b/i.test(def)) return "STORED generated column";
  return null;
}

/**
 * SQL that brings a drifted database to the expected schema WITHOUT touching existing data:
 * creates missing tables / indexes / triggers / views exactly as the migrations define them and
 * adds missing columns with their exact definitions. Anything else (a column whose type,
 * NOT NULL or default differs, or a column SQLite cannot add) is returned as `blocked`.
 */
export function repairPlan(expected, drift) {
  const statements = [];
  const blocked = [];
  for (const t of drift.missingTables) statements.push(`${expected.tables[t].sql};`);
  for (const { table, column } of drift.missingColumns) {
    if (drift.missingTables.includes(table)) continue;
    const def = columnDefinitions(expected.tables[table].sql)[column];
    const blocker = def ? addColumnBlocker(def) : "definition not found";
    if (blocker) blocked.push(`${table}.${column}: ${blocker}`);
    else statements.push(`ALTER TABLE ${table} ADD COLUMN ${def};`);
  }
  for (const c of drift.changedColumns) blocked.push(`${c.table}.${c.column}: ${c.differences.join(", ")} (needs a new migration that rebuilds the table)`);
  for (const i of drift.missingIndexes) statements.push(`${expected.indexes[i].sql};`);
  for (const i of drift.missingTriggers) statements.push(`${expected.triggers[i].sql};`);
  for (const v of drift.missingViews) statements.push(`${expected.views[v].sql};`);
  return { statements, blocked };
}

/** Names-only view of a schema (what the Worker checks at runtime). */
export function requiredShape(schema) {
  return {
    tables: Object.fromEntries(
      Object.entries(schema.tables)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, t]) => [name, t.columns.map((c) => c.name)]),
    ),
    indexes: Object.keys(schema.indexes).sort(),
  };
}
