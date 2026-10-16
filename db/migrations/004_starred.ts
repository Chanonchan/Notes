import type { Migration } from './index';

/** Star: marks an entry as important to its project. */
export const m004Starred: Migration = {
  version: 4,
  name: 'starred',
  up: async (db) => {
    await db.exec('ALTER TABLE entries ADD COLUMN starred INTEGER NOT NULL DEFAULT 0');
  },
};
