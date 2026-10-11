import * as SQLite from 'expo-sqlite';

import { makeTransaction, type Db } from './client';

export async function openExpoDb(name = 'daylog.db'): Promise<Db> {
  const db = await SQLite.openDatabaseAsync(name);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  return {
    exec: (sql) => db.execAsync(sql),
    run: (sql, params = []) => db.runAsync(sql, params),
    all: (sql, params = []) => db.getAllAsync(sql, params),
    get: (sql, params = []) => db.getFirstAsync(sql, params),
    transaction: makeTransaction((sql) => db.execAsync(sql)),
  };
}
