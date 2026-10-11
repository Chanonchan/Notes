// Test-only Db backed by Node's built-in SQLite, running the app's real migrations.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite');

import { makeTransaction, type Db, type SqlValue } from '../../db/client';
import { migrate } from '../../db/migrations';

export function openNodeDb(): Db {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const plain = <T>(row: unknown) => (row ? ({ ...(row as object) } as T) : null);
  const exec = async (sql: string) => {
    db.exec(sql);
  };

  return {
    exec,
    run: async (sql: string, params: SqlValue[] = []) => {
      const r = db.prepare(sql).run(...params);
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    all: async <T>(sql: string, params: SqlValue[] = []) =>
      db.prepare(sql).all(...params).map((r: unknown) => plain<T>(r) as T),
    get: async <T>(sql: string, params: SqlValue[] = []) => plain<T>(db.prepare(sql).get(...params)),
    transaction: makeTransaction(exec),
  };
}

export async function openMigratedDb(): Promise<Db> {
  const db = openNodeDb();
  await migrate(db);
  return db;
}
