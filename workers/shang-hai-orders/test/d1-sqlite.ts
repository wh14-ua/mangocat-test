import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { D1Like, D1Result, D1Statement } from "../src/env";

const MIGRATIONS_DIR = new URL("../migrations/", import.meta.url);

export const MIGRATIONS = readdirSync(MIGRATIONS_DIR)
  .filter((f) => /^\d{4}_.+\.sql$/.test(f))
  .sort();

export function applyMigrations(db: DatabaseSync, upTo = MIGRATIONS.length) {
  for (const file of MIGRATIONS.slice(0, upTo)) db.exec(readFileSync(new URL(file, MIGRATIONS_DIR), "utf8"));
}

/**
 * Minimal D1-compatible adapter over node:sqlite for tests. It applies the real migration
 * files (foreign keys ON, like D1), so the SQL and constraints under test are the
 * production ones. `migrations` limits how many are applied (migration tests).
 */
export function createTestD1(options: { migrations?: number } = {}): D1Like & { raw: DatabaseSync } {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  applyMigrations(db, options.migrations);

  class Statement implements D1Statement {
    constructor(
      readonly sql: string,
      readonly params: SQLInputValue[] = [],
    ) {}
    bind(...values: (string | number | null)[]): D1Statement {
      return new Statement(this.sql, values);
    }
    async first<T = Record<string, unknown>>(): Promise<T | null> {
      return (db.prepare(this.sql).get(...this.params) as T | undefined) ?? null;
    }
    async run(): Promise<D1Result<Record<string, unknown>>> {
      const r = db.prepare(this.sql).run(...this.params);
      return { results: [], success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
    }
    async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
      return { results: db.prepare(this.sql).all(...this.params) as T[], success: true, meta: {} };
    }
  }

  return {
    raw: db,
    prepare: (sql: string) => new Statement(sql),
    async batch(statements: D1Statement[]) {
      db.exec("BEGIN");
      try {
        const out: D1Result<Record<string, unknown>>[] = [];
        for (const s of statements) out.push(await s.run());
        db.exec("COMMIT");
        return out;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
