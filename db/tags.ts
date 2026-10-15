import type { Tag } from '../types';
import type { Db } from './client';

export function normalizeTag(name: string): string {
  return name.trim().replace(/^#/, '').replace(/\s+/g, '-').toLowerCase();
}

export async function listTags(db: Db): Promise<Tag[]> {
  return db.all<Tag>('SELECT id, name FROM tags ORDER BY name');
}

/** Replaces the tags of an entry. Creates missing tags; unused tags are kept. */
export async function setEntryTags(db: Db, entryId: number, names: string[]): Promise<void> {
  const clean = [...new Set(names.map(normalizeTag).filter(Boolean))];
  await db.run('DELETE FROM entry_tags WHERE entry_id = ?', [entryId]);
  for (const name of clean) {
    await db.run('INSERT OR IGNORE INTO tags (name) VALUES (?)', [name]);
    await db.run(
      'INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) SELECT ?, id FROM tags WHERE name = ?',
      [entryId, name],
    );
  }
}

/** Tag names keyed by entry id. */
export async function tagsForEntries(db: Db, entryIds: number[]): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();
  // Chunk to stay under SQLite's bound-parameter limit.
  for (let i = 0; i < entryIds.length; i += 500) {
    const chunk = entryIds.slice(i, i + 500);
    const rows = await db.all<{ entry_id: number; name: string }>(
      `SELECT et.entry_id, t.name FROM entry_tags et JOIN tags t ON t.id = et.tag_id
       WHERE et.entry_id IN (${chunk.map(() => '?').join(',')}) ORDER BY t.name`,
      chunk,
    );
    for (const r of rows) {
      const list = map.get(r.entry_id) ?? [];
      list.push(r.name);
      map.set(r.entry_id, list);
    }
  }
  return map;
}

/** Topic tags keep what was typed (spaces and case); only "#" and extra spaces are dropped. */
export function cleanTopicTag(name: string): string {
  return name.trim().replace(/^#+/, '').replace(/\s+/g, ' ').trim();
}

/** Unique (case-insensitive) cleaned tags, in the order given. */
export function cleanTopicTags(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names.map(cleanTopicTag)) {
    if (!n || seen.has(n.toLowerCase())) continue;
    seen.add(n.toLowerCase());
    out.push(n);
  }
  return out;
}

async function tagId(db: Db, name: string): Promise<number> {
  await db.run('INSERT OR IGNORE INTO tags (name) VALUES (?)', [name]);
  const row = await db.get<{ id: number }>('SELECT id FROM tags WHERE name = ?', [name]);
  return row!.id;
}

/** Replaces a topic's tags. */
export async function setTopicTags(db: Db, topicId: number, names: string[]): Promise<string[]> {
  const clean = cleanTopicTags(names);
  await db.transaction(async () => {
    await db.run('DELETE FROM topic_tags WHERE topic_id = ?', [topicId]);
    for (const name of clean) {
      await db.run('INSERT OR IGNORE INTO topic_tags (topic_id, tag_id) VALUES (?, ?)', [topicId, await tagId(db, name)]);
    }
  });
  return clean;
}

/** Adds tags to a topic, keeping the ones it has. */
export async function addTopicTags(db: Db, topicId: number, names: string[]): Promise<void> {
  for (const name of cleanTopicTags(names)) {
    await db.run('INSERT OR IGNORE INTO topic_tags (topic_id, tag_id) VALUES (?, ?)', [topicId, await tagId(db, name)]);
  }
}

/** Tag names of every topic, keyed by topic id. */
export async function listTopicTags(db: Db): Promise<Map<number, string[]>> {
  const rows = await db.all<{ topic_id: number; name: string }>(
    'SELECT tt.topic_id, t.name FROM topic_tags tt JOIN tags t ON t.id = tt.tag_id ORDER BY t.name COLLATE NOCASE',
  );
  const map = new Map<number, string[]>();
  for (const r of rows) map.set(r.topic_id, [...(map.get(r.topic_id) ?? []), r.name]);
  return map;
}
