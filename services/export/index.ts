import { createEntry, findTopicByName, listTopics, queryEntries } from '../../db';
import type { Db } from '../../db/client';
import { ENTRY_TYPES, ENTRY_TYPE_LABELS, type Entry, type EntryType, type Topic } from '../../types';
import { formatDayLong, formatDuration, formatTime } from '../dates';

export const BACKUP_FORMAT = 'daylog-backup';
export const BACKUP_VERSION = 1;

/** Everything needed to rebuild the log elsewhere. Plain JSON, stable field names. */
export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  topics: Topic[];
  entries: Entry[];
}

export async function buildBackup(db: Db): Promise<Backup> {
  const [topics, entries] = await Promise.all([
    listTopics(db, { includeArchived: true }),
    queryEntries(db, 'SELECT * FROM entries ORDER BY day, created_at, id'),
  ]);
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), topics, entries };
}

export async function exportJson(db: Db): Promise<string> {
  return JSON.stringify(await buildBackup(db), null, 1);
}

/** Readable log of everything, oldest day first. */
export async function exportText(db: Db): Promise<string> {
  const { topics, entries } = await buildBackup(db);
  const names = new Map(topics.map((t) => [t.id, t.name]));
  const lines = [`DayLog export · ${entries.length} entries · ${new Date().toLocaleString()}`];
  let day = '';
  for (const e of entries) {
    if (e.day !== day) {
      day = e.day;
      lines.push('', formatDayLong(day));
    }
    const topic = e.topicId != null ? names.get(e.topicId) : undefined;
    const extra = [e.durationMinutes ? formatDuration(e.durationMinutes) : null, ...e.tags.map((x) => `#${x}`)].filter(Boolean);
    lines.push(
      `  ${formatTime(e.createdAt)}  [${ENTRY_TYPE_LABELS[e.type]}]${topic ? ` ${topic}:` : ''} ${e.text}${extra.length ? ` (${extra.join(', ')})` : ''}`,
    );
  }
  return lines.join('\n');
}

/** Parses and validates a backup; throws a readable error if it isn't one. */
export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text.trim());
  } catch {
    throw new Error('This is not a DayLog backup (it is not valid JSON). Copy the whole backup and try again.');
  }
  const b = data as Partial<Backup>;
  if (!b || b.format !== BACKUP_FORMAT || !Array.isArray(b.topics) || !Array.isArray(b.entries)) {
    throw new Error('This is not a DayLog backup.');
  }
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of DayLog. Update the app and try again.');
  }
  for (const e of b.entries) {
    if (typeof e?.text !== 'string' || !e.text.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(String(e.day))) {
      throw new Error('This backup is damaged (an entry is missing its text or day).');
    }
  }
  return b as Backup;
}

export interface ImportResult {
  entriesAdded: number;
  entriesSkipped: number;
  topicsAdded: number;
}

const entryKey = (day: string, createdAt: number, text: string) => `${day}|${createdAt}|${text.trim()}`;

/**
 * Merges a backup into this log. Nothing here is deleted or overwritten:
 * topics are matched by name, and entries already present (same day, time
 * and text) are skipped — so importing the same backup twice is harmless.
 */
export async function importBackup(db: Db, backup: Backup): Promise<ImportResult> {
  const result: ImportResult = { entriesAdded: 0, entriesSkipped: 0, topicsAdded: 0 };
  const existing = new Set(
    (await db.all<{ day: string; created_at: number; text: string }>('SELECT day, created_at, text FROM entries')).map((r) =>
      entryKey(r.day, r.created_at, r.text),
    ),
  );

  await db.transaction(async () => {
    // Topics: backup id → local id.
    const topicIds = new Map<number, number>();
    for (const t of backup.topics) {
      const name = String(t.name ?? '').trim();
      if (!name) continue;
      const found = await findTopicByName(db, name);
      if (found) {
        topicIds.set(t.id, found.id);
        continue;
      }
      const res = await db.run('INSERT INTO topics (name, color, archived, created_at) VALUES (?, ?, ?, ?)', [
        name,
        /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : '#4F7DF3',
        t.archived ? 1 : 0,
        Number(t.createdAt) || Date.now(),
      ]);
      topicIds.set(t.id, res.lastInsertRowId);
      result.topicsAdded++;
    }

    // Entries, oldest first so carry-over links can point at already-imported ones.
    const entryIds = new Map<number, number>();
    const sorted = [...backup.entries].sort((a, b) => a.createdAt - b.createdAt || a.id - b.id);
    for (const e of sorted) {
      const createdAt = Number(e.createdAt) || Date.now();
      const key = entryKey(e.day, createdAt, e.text);
      if (existing.has(key)) {
        result.entriesSkipped++;
        continue;
      }
      const created = await createEntry(db, {
        topicId: e.topicId != null ? (topicIds.get(e.topicId) ?? null) : null,
        text: e.text,
        type: (ENTRY_TYPES as readonly string[]).includes(e.type) ? (e.type as EntryType) : 'done',
        durationMinutes: typeof e.durationMinutes === 'number' && e.durationMinutes >= 0 ? e.durationMinutes : null,
        day: e.day,
        createdAt,
        carriedFromId: e.carriedFromId != null ? (entryIds.get(e.carriedFromId) ?? null) : null,
        tags: Array.isArray(e.tags) ? e.tags.filter((x) => typeof x === 'string') : [],
      });
      entryIds.set(e.id, created.id);
      existing.add(key);
      result.entriesAdded++;
    }
  });
  return result;
}

/** Quick counts for the backup screen. */
export async function storageStats(db: Db): Promise<{ entries: number; topics: number; firstDay: string | null }> {
  const row = await db.get<{ entries: number; first_day: string | null }>('SELECT COUNT(*) AS entries, MIN(day) AS first_day FROM entries');
  const topics = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM topics');
  return { entries: row?.entries ?? 0, topics: topics?.n ?? 0, firstDay: row?.first_day ?? null };
}

/** Permanently removes every entry, topic, tag and setting from this log. */
export async function deleteAllData(db: Db): Promise<void> {
  await db.transaction(async () => {
    await db.run('DELETE FROM entry_tags');
    await db.run('DELETE FROM entries');
    await db.run('DELETE FROM tags');
    await db.run('DELETE FROM topics');
    await db.run('DELETE FROM settings');
  });
}
