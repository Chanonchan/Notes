import { addDays } from '../services/dates';
import type { DayKey, Entry } from '../types';
import type { Db } from './client';
import { createEntry, queryEntries } from './entries';
import { getSetting, setSetting } from './settings';

/** How far back to look for the previous logged day (covers weekends/holidays). */
const LOOKBACK_DAYS = 7;

export interface CarryOver {
  /** The most recent earlier day that has entries. */
  fromDay: DayKey;
  /** Its Next / In progress / Blocked entries not yet continued. */
  items: Entry[];
}

/**
 * Open items from the last logged day before `today` (usually yesterday, or
 * Saturday/Friday after a day off) that haven't been continued yet. An item
 * whose text was later logged again in the same topic counts as handled.
 */
export async function getCarryOver(db: Db, today: DayKey): Promise<CarryOver | null> {
  const prev = await db.get<{ day: string }>(
    'SELECT MAX(day) AS day FROM entries WHERE day < ? AND day >= ?',
    [today, addDays(today, -LOOKBACK_DAYS)],
  );
  if (!prev?.day) return null;

  const items = await queryEntries(
    db,
    `SELECT e.* FROM entries e
     WHERE e.day = ?
       AND e.type IN ('next', 'in_progress', 'blocked')
       AND NOT EXISTS (SELECT 1 FROM entries c WHERE c.carried_from_id = e.id)
       AND NOT EXISTS (
         SELECT 1 FROM entries l
         WHERE l.day > e.day AND l.day <= ?
           AND l.topic_id IS e.topic_id
           AND lower(trim(l.text)) = lower(trim(e.text)))
     ORDER BY CASE e.type WHEN 'blocked' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, e.created_at`,
    [prev.day, today],
  );
  return items.length ? { fromDay: prev.day, items } : null;
}

/**
 * Copies the given entries to `today`, linked via carried_from_id, keeping
 * their type (Next steps land in today's Next steps box).
 */
export async function continueItems(db: Db, items: Entry[], today: DayKey): Promise<Entry[]> {
  const created: Entry[] = [];
  await db.transaction(async () => {
    for (const item of items) {
      created.push(
        await createEntry(db, {
          topicId: item.topicId,
          text: item.text,
          type: item.type,
          day: today,
          carriedFromId: item.id,
          tags: item.tags,
        }),
      );
    }
  });
  await setSetting(db, 'carryover_dismissed_day', today);
  return created;
}

/** Whether to pop up the carry-over prompt now: once per day, and only if there is something to carry. */
export async function shouldPromptCarryOver(db: Db, today: DayKey): Promise<boolean> {
  if ((await getSetting(db, 'last_carryover_day')) === today) return false;
  if ((await getSetting(db, 'carryover_dismissed_day')) === today) return false;
  return (await getCarryOver(db, today)) !== null;
}

export async function markCarryOverPrompted(db: Db, today: DayKey): Promise<void> {
  await setSetting(db, 'last_carryover_day', today);
}

/** "Not today": hide the prompt and the Today-screen banner until tomorrow. */
export async function dismissCarryOver(db: Db, today: DayKey): Promise<void> {
  await setSetting(db, 'carryover_dismissed_day', today);
}

export async function isCarryOverDismissed(db: Db, today: DayKey): Promise<boolean> {
  return (await getSetting(db, 'carryover_dismissed_day')) === today;
}
