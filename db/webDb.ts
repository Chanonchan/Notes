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

/**
 * Asks the browser to keep this site's storage permanently (not cleared
 * automatically when the phone runs low on space). Installed home-screen
 * apps are usually granted this. Returns whether storage is persistent.
 */
export async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function openWebDb(): Promise<Db> {
  const SQL = await initSqlJs();
  const saved = await load().catch(() => null);
  const db: Database = saved ? new SQL.Database(saved) : new SQL.Database();
  db.exec('PRAGMA foreign_keys = ON');

  // Save right after every write. Saves never overlap: writes made while one
  // is running are picked up by one more save straight after.
  let inTx = false;
  let saving: Promise<void> | null = null;
  let dirty = false;
  const saveNow = (): Promise<void> => {
    if (inTx) {
      dirty = true;
      return Promise.resolve();
    }
    if (saving) {
      dirty = true;
      return saving;
    }
    dirty = false;
    const bytes = db.export();
    // sql.js's export() reopens the database, which resets connection pragmas.
    db.exec('PRAGMA foreign_keys = ON');
    saving = save(bytes)
      .catch((e) => console.warn('DayLog: could not save', e))
      .finally(() => {
        saving = null;
        if (dirty) void saveNow();
      });
    return saving;
  };
  const scheduleSave = () => void saveNow();
  if (typeof window !== 'undefined') {
    // Belt and braces for the app being closed or backgrounded mid-write.
    window.addEventListener('pagehide', () => void saveNow());
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && void saveNow());
  }
  // Ask the browser not to evict our data under storage pressure.
  void requestPersistentStorage();

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
