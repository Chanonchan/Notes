import { useRef, useState } from 'react';

import { updateEntry } from '../db';
import type { Entry, EntryType } from '../types';
import { useMutation } from './useDb';

export interface UndoInfo {
  id: number;
  type: EntryType;
  day: string;
  text: string;
  newType: EntryType;
}

/** The last ticked-off job, so a mis-tap can be undone for a few seconds. */
export function useUndo() {
  const [undo, setUndo] = useState<UndoInfo | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restore = useMutation((db, id: number, type: EntryType, day: string) => updateEntry(db, id, { type, day }));

  const offer = (e: Entry, newType: EntryType = 'done') => {
    if (timer.current) clearTimeout(timer.current);
    setUndo({ id: e.id, type: e.type, day: e.day, text: e.text, newType });
    timer.current = setTimeout(() => setUndo(null), 5000);
  };
  const run = async () => {
    const u = undo;
    setUndo(null);
    if (u) await restore(u.id, u.type, u.day);
  };
  return { undo, offer, run };
}
