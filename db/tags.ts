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
