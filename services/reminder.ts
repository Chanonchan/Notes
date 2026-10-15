import { fromDayKey } from './dates';
import type { DayKey } from '../types';

export const DEFAULT_REMINDER_TIME = '17:30';
export const REMINDER_OFF = 'off';

/** "17:30" → minutes after midnight; null if invalid. */
export function parseTime(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = +m[1];
  const min = +m[2];
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/**
 * The in-app end-of-day reminder shows on a workday once the reminder time
 * has passed, until it's dismissed (or something is logged after it fired).
 */
export function shouldShowReminder(opts: {
  now: Date;
  today: DayKey;
  /** "HH:MM", or "off". */
  time: string;
  workdays: number[];
  dismissedDay: string | null;
  /** Timestamp of the last entry created today, if any. */
  lastEntryAt: number | null;
}): boolean {
  const { now, today, time, workdays, dismissedDay, lastEntryAt } = opts;
  if (time === REMINDER_OFF || dismissedDay === today) return false;
  if (!workdays.includes(fromDayKey(today).getDay())) return false;
  const at = parseTime(time);
  if (at === null) return false;
  if (now.getHours() * 60 + now.getMinutes() < at) return false;
  // Logged something after the reminder time? Then it has done its job.
  const fireTime = new Date(now);
  fireTime.setHours(Math.floor(at / 60), at % 60, 0, 0);
  return !(lastEntryAt != null && lastEntryAt >= fireTime.getTime());
}
