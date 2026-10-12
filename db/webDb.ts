// Web build: SQLite compiled to JS (sql.js), persisted to IndexedDB.
// expo-sqlite's web backend needs cross-origin-isolation headers that static
// hosts like GitHub Pages can't send, so the browser uses this adapter instead.
import initSqlJs from 'sql.js/dist/sql-asm-memory-growth.js';
import type { Database } from 'sql.js';

import { makeTransaction, type Db, type SqlValue } from './client';

const IDB_NAME = 'daylog';
const IDB_STORE = 'files';
const IDB_KEY = 'daylog.db';

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function load(): Promise<Uint8Array | null> {
  const store = (await idb()).transaction(IDB_STORE).objectStore(IDB_STORE);
  return new Promise((resolve, reject) => {
    const req = store.get(IDB_KEY);
    req.onsuccess = () => resolve((req.result as Uint8Array | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function save(bytes: Uint8Array): Promise<void> {
  const tx = (await idb()).transaction(IDB_STORE, 'readwrite');
  tx.objectStore(IDB_STORE).put(bytes, IDB_KEY);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function openWebDb(): Promise<Db> {
  const SQL = await initSqlJs();
  const saved = await load().catch(() => null);
  const db: Database = saved ? new SQL.Database(saved) : new SQL.Database();
  db.exec('PRAGMA foreign_keys = ON');

  // Persist shortly after writes; flush immediately when the tab is hidden.
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inTx = false;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!inTx) save(db.export()).catch((e) => console.warn('DayLog: could not save', e));
  };
  const scheduleSave = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, 300);
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && timer && flush());
  }

  const rows = <T>(sql: string, params: SqlValue[]): T[] => {
    const stmt = db.prepare(sql);
    try {
      stmt.bind(params);
      const out: T[] = [];
      while (stmt.step()) out.push(stmt.getAsObject() as T);
      return out;
    } finally {
      stmt.free();
    }
  };

  const exec = async (sql: string) => {
    const upper = sql.trim().toUpperCase();
    if (upper === 'BEGIN') inTx = true;
    db.exec(sql);
    if (upper === 'COMMIT' || upper === 'ROLLBACK') inTx = false;
    if (!upper.startsWith('PRAGMA FOREIGN_KEYS')) scheduleSave();
  };

  return {
    exec,
    run: async (sql, params = []) => {
      db.run(sql, params);
      const id = rows<{ id: number }>('SELECT last_insert_rowid() AS id', [])[0]?.id ?? 0;
      scheduleSave();
      return { lastInsertRowId: id, changes: db.getRowsModified() };
    },
    all: async (sql, params = []) => rows(sql, params),
    get: async (sql, params = []) => rows<never>(sql, params)[0] ?? null,
    transaction: makeTransaction(exec),
  };
}
