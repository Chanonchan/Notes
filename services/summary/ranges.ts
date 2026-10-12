import { addDays, formatDayLong, fromDayKey, monthName, toDayKey } from '../dates';
import type { DayKey } from '../../types';
import type { RangeKind, SummaryRange } from './types';

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The day / week (Mon–Sun) / month containing `day`. */
export function rangeFor(kind: Exclude<RangeKind, 'custom'>, day: DayKey): SummaryRange {
  if (kind === 'day') return { kind, from: day, to: day };
  const d = fromDayKey(day);
  if (kind === 'week') {
    const from = addDays(day, -((d.getDay() + 6) % 7));
    return { kind, from, to: addDays(from, 6) };
  }
  return {
    kind,
    from: toDayKey(new Date(d.getFullYear(), d.getMonth(), 1)),
    to: toDayKey(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  };
}

/** Previous / next period of the same kind. Custom ranges shift by their length. */
export function shiftRange(range: SummaryRange, dir: -1 | 1): SummaryRange {
  if (range.kind === 'custom') {
    const len = Math.round((fromDayKey(range.to).getTime() - fromDayKey(range.from).getTime()) / 86_400_000) + 1;
    return { kind: 'custom', from: addDays(range.from, dir * len), to: addDays(range.to, dir * len) };
  }
  if (range.kind === 'month') {
    const d = fromDayKey(range.from);
    return rangeFor('month', toDayKey(new Date(d.getFullYear(), d.getMonth() + dir, 1)));
  }
  return rangeFor(range.kind, addDays(range.from, dir * (range.kind === 'week' ? 7 : 1)));
}

function short(day: DayKey, withYear = false): string {
  const d = fromDayKey(day);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ''}`;
}

/** "Mon, 12 Oct 2026" · "Week of Mon 5 Oct – Sun 11 Oct 2026" · "October 2026" · "Mon 1 Sep – Fri 12 Sep 2026" */
export function formatRange(range: SummaryRange): string {
  if (range.kind === 'day' || range.from === range.to) return formatDayLong(range.from);
  if (range.kind === 'month') {
    const d = fromDayKey(range.from);
    return `${monthName(d.getMonth())} ${d.getFullYear()}`;
  }
  const sameYear = range.from.slice(0, 4) === range.to.slice(0, 4);
  const text = `${short(range.from, !sameYear)} – ${short(range.to, true)}`;
  return range.kind === 'week' ? `Week of ${text}` : text;
}

/** Number of days in the range, inclusive. */
export function rangeLength(range: SummaryRange): number {
  return Math.round((fromDayKey(range.to).getTime() - fromDayKey(range.from).getTime()) / 86_400_000) + 1;
}
