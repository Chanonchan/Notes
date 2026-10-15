import { addDays, fromDayKey } from './dates';
import type { DayKey } from '../types';

/** Default workdays: Monday–Saturday (0 = Sunday … 6 = Saturday). */
export const DEFAULT_WORKDAYS = [1, 2, 3, 4, 5, 6];

export interface Streak {
  /** Consecutive workdays with at least one entry, up to today (or the last workday). */
  current: number;
  /** Longest such run ever. */
  best: number;
  /** Whether today already has an entry. */
  loggedToday: boolean;
  /** Today is a workday with nothing logged yet, and the streak continues if you log. */
  atRisk: boolean;
}

const isWorkday = (day: DayKey, workdays: number[]) => workdays.includes(fromDayKey(day).getDay());

/**
 * Counts consecutive logged workdays. Days off (e.g. Sunday) are skipped, not
 * counted as breaks, and today only breaks the streak once it's over — so an
 * unlogged morning still shows yesterday's streak.
 */
export function computeStreak(loggedDays: Iterable<DayKey>, today: DayKey, workdays = DEFAULT_WORKDAYS): Streak {
  const logged = new Set(loggedDays);
  const loggedToday = logged.has(today);

  // Current: walk back from today (or the previous day if today isn't logged yet).
  let current = 0;
  let day = loggedToday ? today : addDays(today, -1);
  for (let guard = 0; guard < 3660; guard++) {
    if (isWorkday(day, workdays)) {
      if (!logged.has(day)) break;
      current++;
    } else if (logged.has(day)) {
      current++; // Logging on a day off counts, but missing one never breaks.
    }
    day = addDays(day, -1);
  }

  // Best: scan all logged history in order.
  const sorted = [...logged].sort();
  let best = 0;
  let run = 0;
  let prev: DayKey | null = null;
  for (const d of sorted) {
    if (prev) {
      // Any missed workday between prev and d breaks the run.
      let gap = addDays(prev, 1);
      let broken = false;
      while (gap < d) {
        if (isWorkday(gap, workdays)) {
          broken = true;
          break;
        }
        gap = addDays(gap, 1);
      }
      run = broken ? 1 : run + 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    prev = d;
  }
  best = Math.max(best, current);

  return { current, best, loggedToday, atRisk: !loggedToday && isWorkday(today, workdays) && current > 0 };
}

export function parseWorkdays(value: string | null): number[] {
  if (!value) return DEFAULT_WORKDAYS;
  const days = value
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return days.length ? days : DEFAULT_WORKDAYS;
}
