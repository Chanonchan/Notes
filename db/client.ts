/**
 * Minimal async database interface used by every repository.
 *
 * The app implements it with expo-sqlite (db/expoDb.ts); tests implement it
 * with Node's built-in sqlite (__tests__/helpers/nodeDb.ts). Both run the same
 * SQL and migrations, so the repository code is tested as-is.
 */
export type SqlValue = string | number | null;

export interface RunResult {
  lastInsertRowId: number;
  changes: number;
}

export interface Db {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<RunResult>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  get<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  /**
   * Runs `task` inside BEGIN/COMMIT, rolling back if it throws.
   * Nested calls join the outer transaction.
   */
  transaction(task: () => Promise<void>): Promise<void>;
}

/** Builds a nesting-aware `transaction` from a raw `exec`. */
export function makeTransaction(exec: (sql: string) => Promise<void>): Db['transaction'] {
  let depth = 0;
  return async (task) => {
    if (depth > 0) return task();
    depth++;
    await exec('BEGIN');
    try {
      await task();
      await exec('COMMIT');
    } catch (e) {
      await exec('ROLLBACK');
      throw e;
    } finally {
      depth--;
    }
  };
}
