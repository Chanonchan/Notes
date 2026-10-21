import { addDays, daysBetween, formatDayLong, fromDayKey, weekdayShort } from './dates';
import type { DayKey } from '../types';

export type DueTone = 'overdue' | 'soon' | 'later';

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Overdue 2 days", "Due today", "Due tomorrow", "Due Fri", "Due 3 Nov". */
export function formatDue(due: DayKey, today: DayKey): { label: string; tone: DueTone } {
  const diff = daysBetween(today, due);
  if (diff < 0) return { label: diff === -1 ? 'Overdue 1 day' : `Overdue ${-diff} days`, tone: 'overdue' };
  if (diff === 0) return { label: 'Due today', tone: 'soon' };
  if (diff === 1) return { label: 'Due tomorrow', tone: 'soon' };
  if (diff < 7) return { label: `Due ${weekdayShort(due)}`, tone: 'later' };
  const d = fromDayKey(due);
  const sameYear = due.slice(0, 4) === today.slice(0, 4);
  return { label: `Due ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}${sameYear ? '' : ` ${d.getFullYear()}`}`, tone: 'later' };
}

/** Quick picks: Today, Tomorrow, this Friday (or next if it's the weekend), next Monday, in a week. */
export function deadlineChoices(today: DayKey): { label: string; day: DayKey }[] {
  const dow = fromDayKey(today).getDay(); // 0 = Sunday
  const toFri = (5 - dow + 7) % 7;
  const toMon = ((1 - dow + 7) % 7) || 7;
  const choices = [
    { label: 'Today', day: today },
    { label: 'Tomorrow', day: addDays(today, 1) },
    ...(toFri >= 2 ? [{ label: 'Friday', day: addDays(today, toFri) }] : []),
    { label: 'Next Mon', day: addDays(today, toMon) },
    { label: 'In a week', day: addDays(today, 7) },
  ];
  // No duplicate days (e.g. "Next Mon" can equal "In a week").
  return choices.filter((c, i) => choices.findIndex((x) => x.day === c.day) === i);
}

export const describeDue = (due: DayKey) => formatDayLong(due);
