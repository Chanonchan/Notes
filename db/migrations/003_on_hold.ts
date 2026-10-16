import type { Migration } from './index';

/**
 * Adds the "On hold" entry type. SQLite can't change a CHECK constraint in
 * place, so the entries table is rebuilt with the same columns and rows.
 * Dropping the old table cascades to entry_tags, so those rows are kept
 * aside and put back.
 */
export const m003OnHold: Migration = {
  version: 3,
  name: 'on_hold',
  up: async (db) => {
    await db.exec(`
      CREATE TEMP TABLE saved_entry_tags AS SELECT entry_id, tag_id FROM entry_tags;

      CREATE TABLE entries_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
        text TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'done'
          CHECK (type IN ('done', 'in_progress', 'blocked', 'next', 'on_hold')),
        duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
        day TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        carried_from_id INTEGER REFERENCES entries(id) ON DELETE SET NULL
      );
      INSERT INTO entries_new (id, topic_id, text, type, duration_minutes, day, created_at, updated_at, carried_from_id)
        SELECT id, topic_id, text, type, duration_minutes, day, created_at, updated_at, carried_from_id FROM entries;
      -- Keep the carry-over links: the implicit delete on DROP would null them.
      CREATE TEMP TABLE saved_links AS SELECT id, carried_from_id FROM entries WHERE carried_from_id IS NOT NULL;

      DROP TABLE entries;
      ALTER TABLE entries_new RENAME TO entries;

      UPDATE entries SET carried_from_id = (SELECT carried_from_id FROM saved_links s WHERE s.id = entries.id)
        WHERE id IN (SELECT id FROM saved_links);
      INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) SELECT entry_id, tag_id FROM saved_entry_tags;
      DROP TABLE saved_entry_tags;
      DROP TABLE saved_links;

      CREATE INDEX idx_entries_day ON entries(day);
      CREATE INDEX idx_entries_topic_day ON entries(topic_id, day);
      CREATE INDEX idx_entries_type ON entries(type);
      CREATE INDEX idx_entries_carried_from ON entries(carried_from_id);
    `);
  },
};
