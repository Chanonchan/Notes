import type { DayKey, Entry, EntryType } from '../types';
import type { Db, SqlValue } from './client';
import { queryEntries } from './entries';

export interface SearchFilters {
  /** Words to find (all must match, case-insensitive) in the text or tags. */
  query?: string;
  /** undefined = any topic; null = entries without a topic. */
  topicId?: number | null;
  type?: EntryType;
  from?: DayKey;
  to?: DayKey;
  limit?: number;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** True when there is nothing to search for (no words and no filters). */
export function isEmptySearch(f: SearchFilters): boolean {
  return !f.query?.trim() && f.topicId === undefined && !f.type && !f.from && !f.to;
}

/**
 * Searches entries, newest first. Plain LIKE matching (works the same on
 * every SQLite build, including the web one) — fast enough for a personal log.
 */
export async function searchEntries(db: Db, f: SearchFilters): Promise<Entry[]> {
  const where: string[] = [];
  const params: SqlValue[] = [];

  const words = (f.query ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 8);
  for (const w of words) {
    const like = `%${escapeLike(w)}%`;
    where.push(`(e.text LIKE ? ESCAPE '\\' OR EXISTS (
      SELECT 1 FROM entry_tags et JOIN tags t ON t.id = et.tag_id
      WHERE et.entry_id = e.id AND t.name LIKE ? ESCAPE '\\'))`);
    params.push(like, like.replace(/^%#?/, '%'));
  }
  if (f.topicId === null) where.push('e.topic_id IS NULL');
  else if (f.topicId !== undefined) {
    where.push('e.topic_id = ?');
    params.push(f.topicId);
  }
  if (f.type) {
    where.push('e.type = ?');
    params.push(f.type);
  }
  if (f.from) {
    where.push('e.day >= ?');
    params.push(f.from);
  }
  if (f.to) {
    where.push('e.day <= ?');
    params.push(f.to);
  }

  params.push(f.limit ?? 200);
  return queryEntries(
    db,
    `SELECT e.* FROM entries e
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY e.day DESC, e.created_at DESC, e.id DESC
     LIMIT ?`,
    params,
  );
}
