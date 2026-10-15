import type { Migration } from './index';

/**
 * Tags move from entries to topics. Existing entry tags are copied onto
 * the entry's topic so nothing typed before is lost.
 */
export const m002TopicTags: Migration = {
  version: 2,
  name: 'topic_tags',
  up: async (db) => {
    await db.exec(`
      CREATE TABLE topic_tags (
        topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (topic_id, tag_id)
      );
      CREATE INDEX idx_topic_tags_tag ON topic_tags(tag_id);

      INSERT OR IGNORE INTO topic_tags (topic_id, tag_id)
        SELECT DISTINCT e.topic_id, et.tag_id
        FROM entry_tags et JOIN entries e ON e.id = et.entry_id
        WHERE e.topic_id IS NOT NULL;
    `);
  },
};
