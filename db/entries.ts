import { timestampOnDay, toDayKey } from '../services/dates';
import { ENTRY_TYPES, type DayKey, type Entry, type EntryPatch, type NewEntry } from '../types';
import type { Db, SqlValue } from './client';
import { setEntryTags, tagsForEntries } from './tags';

interface EntryRow {
  id: number;
  topic_id: number | null;
  text: string;
  type: Entry['type'];
  duration_minutes: number | null;
  day: string;
  created_at: number;
  updated_at: number;
  carried_from_id: number | null;
  starred: number;
  due_day: string | null;
}

const toEntry = (r: EntryRow, tags: string[] = []): Entry => ({
  id: r.id,
  topicId: r.topic_id,
  text: r.text,
  type: r.type,
  durationMinutes: r.duration_minutes,
  day: r.day,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  carriedFromId: r.carried_from_id,
  tags,
  starred: r.starred === 1,
  dueDay: r.due_day ?? null,
});

async function withTags(db: Db, rows: EntryRow[]): Promise<Entry[]> {
  const tags = await tagsForEntries(db, rows.map((r) => r.id));
  return rows.map((r) => toEntry(r, tags.get(r.id)));
}

function validate(text: string | undefined, type: string | undefined, duration: number | null | undefined, dueDay?: string | null) {
  if (dueDay != null && !/^\d{4}-\d{2}-\d{2}$/.test(dueDay)) throw new Error('Deadline must be a day (YYYY-MM-DD)');
  if (text !== undefined && !text.trim()) throw new Error('Entry text is required');
  if (type !== undefined && !ENTRY_TYPES.includes(type as Entry['type'])) {
    throw new Error(`Invalid entry type: ${type}`);
  }
  if (duration != null && (!Number.isFinite(duration) || duration < 0)) {
    throw new Error('Duration must be a positive number of minutes');
  }
}

export async function createEntry(db: Db, input: NewEntry): Promise<Entry> {
  validate(input.text, input.type, input.durationMinutes, input.dueDay);
  const now = Date.now();
  const day = input.day ?? toDayKey(input.createdAt ?? now);
  // Entries added to another day get a timestamp on that day.
  const createdAt = input.createdAt ?? (day === toDayKey(now) ? now : timestampOnDay(day));
  let id = 0;

  await db.transaction(async () => {
    const res = await db.run(
      `INSERT INTO entries (topic_id, text, type, duration_minutes, day, created_at, updated_at, carried_from_id, starred, due_day)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.topicId,
        input.text.trim(),
        input.type ?? 'done',
        input.durationMinutes != null ? Math.round(input.durationMinutes) : null,
        day,
        createdAt,
        now,
        input.carriedFromId ?? null,
        input.starred ? 1 : 0,
        input.dueDay ?? null,
      ],
    );
    id = res.lastInsertRowId;
    if (input.tags?.length) await setEntryTags(db, id, input.tags);
  });

  const created = await getEntry(db, id);
  if (!created) throw new Error('Failed to create entry');
  return created;
}

export async function getEntry(db: Db, id: number): Promise<Entry | null> {
  const row = await db.get<EntryRow>('SELECT * FROM entries WHERE id = ?', [id]);
  if (!row) return null;
  const [entry] = await withTags(db, [row]);
  return entry;
}

export async function updateEntry(db: Db, id: number, patch: EntryPatch): Promise<Entry> {
  validate(patch.text, patch.type, patch.durationMinutes, patch.dueDay);
  const sets: string[] = [];
  const params: SqlValue[] = [];
  const set = (col: string, v: SqlValue) => {
    sets.push(`${col} = ?`);
    params.push(v);
  };

  if (patch.topicId !== undefined) set('topic_id', patch.topicId);
  if (patch.text !== undefined) set('text', patch.text.trim());
  if (patch.type !== undefined) set('type', patch.type);
  if (patch.starred !== undefined) set('starred', patch.starred ? 1 : 0);
  if (patch.dueDay !== undefined) set('due_day', patch.dueDay);
  if (patch.durationMinutes !== undefined) {
    set('duration_minutes', patch.durationMinutes == null ? null : Math.round(patch.durationMinutes));
  }
  if (patch.day !== undefined) {
    const current = await db.get<{ day: string; created_at: number }>(
      'SELECT day, created_at FROM entries WHERE id = ?',
      [id],
    );
    if (current && current.day !== patch.day) {
      set('day', patch.day);
      set('created_at', timestampOnDay(patch.day, new Date(current.created_at)));
    }
  }
  set('updated_at', Date.now());

  await db.transaction(async () => {
    await db.run(`UPDATE entries SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
    if (patch.tags !== undefined) await setEntryTags(db, id, patch.tags);
  });

  const updated = await getEntry(db, id);
  if (!updated) throw new Error(`Entry ${id} not found`);
  return updated;
}

export async function deleteEntry(db: Db, id: number): Promise<void> {
  await db.run('DELETE FROM entries WHERE id = ?', [id]);
}

/** Entries of one day, oldest first. */
export async function listEntriesByDay(db: Db, day: DayKey): Promise<Entry[]> {
  const rows = await db.all<EntryRow>('SELECT * FROM entries WHERE day = ? ORDER BY created_at, id', [day]);
  return withTags(db, rows);
}

/** Entries with `from <= day <= to`, oldest first. */
export async function listEntriesInRange(db: Db, from: DayKey, to: DayKey): Promise<Entry[]> {
  const rows = await db.all<EntryRow>(
    'SELECT * FROM entries WHERE day BETWEEN ? AND ? ORDER BY day, created_at, id',
    [from, to],
  );
  return withTags(db, rows);
}

/** Recent texts per topic — the corpus for topic auto-suggest. */
export async function recentTextsByTopic(db: Db, perTopic = 50): Promise<Map<number, string[]>> {
  const rows = await db.all<{ topic_id: number; text: string }>(
    `SELECT topic_id, text FROM (
       SELECT e.topic_id, e.text,
              ROW_NUMBER() OVER (PARTITION BY e.topic_id ORDER BY e.created_at DESC) AS rn
       FROM entries e JOIN topics t ON t.id = e.topic_id
       WHERE t.archived = 0
     ) WHERE rn <= ?`,
    [perTopic],
  );
  const map = new Map<number, string[]>();
  for (const r of rows) {
    const list = map.get(r.topic_id) ?? [];
    list.push(r.text);
    map.set(r.topic_id, list);
  }
  return map;
}

/** All entries of a topic (null = entries without a topic), newest day first. */
export async function listEntriesByTopic(db: Db, topicId: number | null): Promise<Entry[]> {
  const rows = await db.all<EntryRow>(
    `SELECT * FROM entries WHERE ${topicId === null ? 'topic_id IS NULL' : 'topic_id = ?'}
     ORDER BY day DESC, created_at, id`,
    topicId === null ? [] : [topicId],
  );
  return withTags(db, rows);
}

/** Number of entries per day in `from..to`, for the calendar. */
export async function countEntriesByDay(db: Db, from: DayKey, to: DayKey): Promise<Map<DayKey, number>> {
  const rows = await db.all<{ day: string; n: number }>(
    'SELECT day, COUNT(*) AS n FROM entries WHERE day BETWEEN ? AND ? GROUP BY day',
    [from, to],
  );
  return new Map(rows.map((r) => [r.day, r.n]));
}

/** Runs a `SELECT * FROM entries …` query and maps rows (with tags) to Entry. */
export async function queryEntries(db: Db, sql: string, params: SqlValue[] = []): Promise<Entry[]> {
  return withTags(db, await db.all<EntryRow>(sql, params));
}
