import type { Migration } from './index';

/** Optional deadline for open work (In progress / Next). */
export const m005DueDay: Migration = {
  version: 5,
  name: 'due_day',
  up: async (db) => {
    await db.exec(`
      ALTER TABLE entries ADD COLUMN due_day TEXT;
      CREATE INDEX idx_entries_due_day ON entries(due_day);
    `);
  },
};
