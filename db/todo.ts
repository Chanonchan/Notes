import { toDayKey } from '../services/dates';
import type { DayKey, Entry, EntryType } from '../types';
import type { Db } from './client';
import { createEntry, getEntry, queryEntries, updateEntry } from './entries';

/** Open work: never expires, stays until its status is updated. */
export const OPEN_TYPES: EntryType[] = ['in_progress', 'blocked', 'next'];

/** All open jobs from any day: In progress, then Blocked, then planned (Next); oldest first. */
export async function listOpenItems(db: Db): Promise<Entry[]> {
  return queryEntries(
    db,
    `SELECT * FROM entries WHERE type IN ('in_progress', 'blocked', 'next')
     ORDER BY CASE type WHEN 'in_progress' THEN 0 WHEN 'blocked' THEN 1 ELSE 2 END, day, created_at, id`,
  );
}

/**
 * Changes a job's status. Finishing a job moves it to the day it was finished
 * (so it shows in that day's log and summary); other changes keep its day.
 */
export async function setStatus(db: Db, id: number, type: EntryType, today: DayKey = toDayKey()): Promise<Entry> {
  if (type === 'done') {
    const current = await getEntry(db, id);
    if (current && current.day !== today) {
      await db.run('UPDATE entries SET type = ?, day = ?, created_at = ?, updated_at = ? WHERE id = ?', [
        'done',
        today,
        Date.now(),
        Date.now(),
        id,
      ]);
      return (await getEntry(db, id))!;
    }
  }
  return updateEntry(db, id, { type });
}

/** Logs what was done on an open job today, without closing it. */
export async function addProgressNote(db: Db, job: Entry, text: string, today: DayKey = toDayKey()): Promise<Entry> {
  return createEntry(db, { topicId: job.topicId, text, type: 'done', day: today, carriedFromId: job.id });
}
