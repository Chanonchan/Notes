import type { Db } from './client';

export type SettingKey =
  | 'last_topic_id'
  | 'reminder_time'
  | 'workdays'
  | 'last_carryover_day'
  | 'carryover_dismissed_day'
  | 'appearance'
  | 'reminder_dismissed_day'
  /** Hand-edited summary text, per period: summary_draft:<kind>:<from>:<to> */
  | `summary_draft:${string}`;

export async function getSetting(db: Db, key: SettingKey): Promise<string | null> {
  const row = await db.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setSetting(db: Db, key: SettingKey, value: string | null): Promise<void> {
  if (value === null) {
    await db.run('DELETE FROM settings WHERE key = ?', [key]);
  } else {
    await db.run(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value],
    );
  }
}

export async function getLastTopicId(db: Db): Promise<number | null> {
  const v = await getSetting(db, 'last_topic_id');
  if (v === null) return null;
  // Ignore a remembered topic that was deleted or archived since.
  const row = await db.get<{ id: number }>('SELECT id FROM topics WHERE id = ? AND archived = 0', [Number(v)]);
  return row?.id ?? null;
}

export async function setLastTopicId(db: Db, id: number | null): Promise<void> {
  await setSetting(db, 'last_topic_id', id === null ? null : String(id));
}
