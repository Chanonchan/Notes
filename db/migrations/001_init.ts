import type { Migration } from './index';

export const m001Init: Migration = {
  version: 1,
  name: 'init',
  up: async (db) => {
    await db.exec(`
      CREATE TABLE topics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        color TEXT NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
        text TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'done'
          CHECK (type IN ('done', 'in_progress', 'blocked', 'next')),
        duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
        day TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        carried_from_id INTEGER REFERENCES entries(id) ON DELETE SET NULL
      );
      CREATE INDEX idx_entries_day ON entries(day);
      CREATE INDEX idx_entries_topic_day ON entries(topic_id, day);
      CREATE INDEX idx_entries_type ON entries(type);
      CREATE INDEX idx_entries_carried_from ON entries(carried_from_id);

      CREATE TABLE tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE
      );

      CREATE TABLE entry_tags (
        entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (entry_id, tag_id)
      );
      CREATE INDEX idx_entry_tags_tag ON entry_tags(tag_id);

      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  },
};
