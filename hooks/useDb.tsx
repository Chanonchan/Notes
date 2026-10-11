import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import type { Db } from '../db/client';

interface DbContextValue {
  db: Db;
  /** Increments after every write, so read hooks know to refetch. */
  version: number;
  notifyChanged: () => void;
}

const DbContext = createContext<DbContextValue | null>(null);

export function DbProvider({ db, children }: { db: Db; children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const notifyChanged = useCallback(() => setVersion((v) => v + 1), []);
  return <DbContext.Provider value={{ db, version, notifyChanged }}>{children}</DbContext.Provider>;
}

export function useDb(): DbContextValue {
  const ctx = useContext(DbContext);
  if (!ctx) throw new Error('useDb must be used inside <DbProvider>');
  return ctx;
}

/**
 * Runs `load` now and again after every DB write (or when `deps` change).
 * Returns the latest result; `data` is undefined until the first load.
 */
export function useQuery<T>(load: (db: Db) => Promise<T>, deps: unknown[] = []) {
  const { db, version } = useDb();
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error>();

  useEffect(() => {
    let cancelled = false;
    load(db).then(
      (d) => !cancelled && (setData(d), setError(undefined)),
      (e) => !cancelled && setError(e instanceof Error ? e : new Error(String(e))),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, version, ...deps]);

  return { data, error };
}

/** Wraps a write so dependent queries refresh after it succeeds. */
export function useMutation<A extends unknown[], R>(fn: (db: Db, ...args: A) => Promise<R>) {
  const { db, notifyChanged } = useDb();
  // Always call the latest `fn`, so it can close over current component state.
  const fnRef = useRef(fn);
  fnRef.current = fn;
  return useCallback(
    async (...args: A) => {
      const r = await fnRef.current(db, ...args);
      notifyChanged();
      return r;
    },
    [db, notifyChanged],
  );
}
