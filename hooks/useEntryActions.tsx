import { useState } from 'react';

import { TypeMenu } from '../components/TypeMenu';
import { deleteEntry, updateEntry } from '../db';
import { confirmDestructive } from '../services/dialogs';
import type { Entry, EntryType } from '../types';
import { useMutation } from './useDb';

/**
 * Quick actions for an entry (change type, delete). Render `menu` once and
 * call `open(entry)` from a row's type badge.
 */
export function useEntryActions() {
  const [target, setTarget] = useState<Entry | null>(null);
  const setType = useMutation((db, id: number, type: EntryType) => updateEntry(db, id, { type }));
  const remove = useMutation((db, id: number) => deleteEntry(db, id));

  const menu = (
    <TypeMenu
      visible={!!target}
      current={target?.type}
      onClose={() => setTarget(null)}
      onSelect={(type) => {
        if (target) setType(target.id, type);
        setTarget(null);
      }}
      onDelete={() => {
        const e = target;
        setTarget(null);
        if (e) confirmDestructive('Delete entry?', e.text, 'Delete', () => remove(e.id));
      }}
    />
  );

  return { open: setTarget, menu };
}
