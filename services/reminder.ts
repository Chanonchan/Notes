import { fromDayKey } from './dates';
import type { DayKey, Entry } from '../types';

export const DEFAULT_REMINDER_TIME = '17:00';
export const REMINDER_OFF = 'off';
/** Every hour of the day, "00:00" … "23:00". */
export const HOURLY_TIMES = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

/** "17:30" → minutes after midnight; null if invalid. */
export function parseTime(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = +m[1];
  const min = +m[2];
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/**
 * The in-app reminder is due on a workday once the reminder time has passed,
 * unless it was already shown today (it shows once a day).
 */
export function shouldShowReminder(opts: {
  now: Date;
  today: DayKey;
  /** "HH:MM", or "off". */
  time: string;
  workdays: number[];
  /** Day the reminder was last shown. */
  shownDay: string | null;
}): boolean {
  const { now, today, time, workdays, shownDay } = opts;
  if (time === REMINDER_OFF || shownDay === today) return false;
  if (!workdays.includes(fromDayKey(today).getDay())) return false;
  const at = parseTime(time);
  if (at === null) return false;
  return now.getHours() * 60 + now.getMinutes() >= at;
}

export interface ReminderGroup {
  topic: string;
  inProgress: string[];
  planned: string[];
}

/** Open jobs grouped by topic for the reminder; busiest topics first, "No topic" last. */
export function groupOpenItems(items: Entry[], topicName: (id: number) => string | undefined): ReminderGroup[] {
  const groups = new Map<number | null, ReminderGroup>();
  for (const e of items) {
    const key = e.topicId != null && topicName(e.topicId) ? e.topicId : null;
    const g = groups.get(key) ?? { topic: key != null ? topicName(key)! : 'No topic', inProgress: [], planned: [] };
    (e.type === 'in_progress' ? g.inProgress : g.planned).push(e.text);
    groups.set(key, g);
  }
  return [...groups.entries()]
    .sort(([ka, a], [kb, b]) =>
      (ka === null ? 1 : 0) - (kb === null ? 1 : 0) ||
      b.inProgress.length + b.planned.length - (a.inProgress.length + a.planned.length) ||
      a.topic.localeCompare(b.topic))
    .map(([, g]) => g);
}
