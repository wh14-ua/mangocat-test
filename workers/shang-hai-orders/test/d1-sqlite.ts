import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { D1Like, D1Result, D1Statement } from "../src/env";

const MIGRATION = new URL("../migrations/0001_init.sql", import.meta.url);

/**
 * Minimal D1-compatible adapter over node:sqlite for tests. It applies the real
 * migration file, so the SQL and constraints under test are the production ones.
 */
export function createTestD1(): D1Like & { raw: DatabaseSync } {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(readFileSync(MIGRATION, "utf8"));

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
