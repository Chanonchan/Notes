import type { DayKey } from '../types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day of a timestamp or Date. */
export function toDayKey(d: Date | number = new Date()): DayKey {
  const date = typeof d === 'number' ? new Date(d) : d;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local midnight of a day key. */
export function fromDayKey(day: DayKey): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(day: DayKey, n: number): DayKey {
  const d = fromDayKey(day);
  d.setDate(d.getDate() + n);
  return toDayKey(d);
}

export function todayKey(): DayKey {
  return toDayKey(new Date());
}

/**
 * A timestamp on `day` that keeps the current wall-clock time, so entries
 * added to a past day sort sensibly among that day's entries.
 */
export function timestampOnDay(day: DayKey, now = new Date()): number {
  const d = fromDayKey(day);
  d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  return d.getTime();
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function weekdayShort(day: DayKey): string {
  return WEEKDAYS[fromDayKey(day).getDay()];
}

export function monthName(month: number): string {
  return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month];
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: DayKey, b: DayKey): number {
  return Math.round((fromDayKey(b).getTime() - fromDayKey(a).getTime()) / 86_400_000);
}

/** "Today", "Yesterday", "3 days ago", else "Sat, 11 Oct 2026". */
export function formatRelativeDay(day: DayKey, today: DayKey = todayKey()): string {
  const diff = daysBetween(day, today);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return `${diff} days ago`;
  return formatDayLong(day);
}

/** e.g. "Sat, 11 Oct 2026" */
export function formatDayLong(day: DayKey): string {
  const d = fromDayKey(day);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Parses a free-form duration into minutes: "90", "45m", "2h", "1.5h",
 * "1h30", "1h 30m", "1:30". Returns null for anything unparseable or zero.
 */
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return null;
  let minutes: number | null = null;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d+):(\d{1,2})$/))) minutes = +m[1] * 60 + +m[2];
  else if ((m = s.match(/^(\d+(?:[.,]\d+)?)h(?:(\d+)m?)?$/))) minutes = parseFloat(m[1].replace(',', '.')) * 60 + (m[2] ? +m[2] : 0);
  else if ((m = s.match(/^(\d+)(?:m|min|mins)?$/))) minutes = +m[1];
  if (minutes === null || !Number.isFinite(minutes)) return null;
  minutes = Math.round(minutes);
  return minutes > 0 && minutes <= 24 * 60 ? minutes : null;
}

/** "1h 30m", "45m", "2h" */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}
