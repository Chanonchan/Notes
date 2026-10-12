import { formatDuration, fromDayKey, weekdayShort } from '../dates';
import { ENTRY_TYPE_LABELS, type EntryType } from '../../types';
import { formatRange, rangeLength } from './ranges';
import type { Summary, TopicSummary } from './types';

const TYPE_ORDER: EntryType[] = ['done', 'in_progress', 'blocked', 'next'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "(Mon, Wed)" within a week, "(5 Oct, 7 Oct)" for longer ranges, nothing if too many. */
function dayList(days: string[], summary: Summary): string {
  if (summary.range.from === summary.range.to || days.length > 6) return '';
  const weekish = rangeLength(summary.range) <= 7;
  const names = days.map((d) => {
    if (weekish) return weekdayShort(d);
    const date = fromDayKey(d);
    return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}`;
  });
  return ` (${names.join(', ')})`;
}

export function formatTopicLine(t: TopicSummary, summary: Summary): string {
  const name = t.topic?.name ?? 'No topic';
  const singleDay = summary.range.from === summary.range.to;
  const parts = [plural(t.entryCount, 'entry', 'entries')];
  if (!singleDay) parts[0] += ` over ${plural(t.days.length, 'day')}${dayList(t.days, summary)}`;
  if (t.totalMinutes) parts.push(formatDuration(t.totalMinutes));
  return `${name}: ${parts.join(', ')}`;
}

/**
 * Plain text for pasting into a standup, report or timesheet. No markdown
 * beyond "•" bullets, so it reads cleanly in chat apps and email.
 */
export function formatSummaryText(summary: Summary): string {
  const lines: string[] = [];
  const { totals } = summary;
  lines.push(`Work summary · ${formatRange(summary.range)}`);

  if (!totals.entries) {
    lines.push('', 'Nothing logged.');
  } else {
    const head = [plural(totals.entries, 'entry', 'entries'), plural(totals.topics, 'topic')];
    if (summary.range.from !== summary.range.to) head.push(plural(totals.days, 'day'));
    if (totals.minutes) head.push(formatDuration(totals.minutes));
    lines.push(head.join(' · '));

    for (const t of summary.topics) {
      lines.push('', formatTopicLine(t, summary));
      for (const type of TYPE_ORDER) {
        const items = t.items[type];
        if (!items.length) continue;
        const label = ENTRY_TYPE_LABELS[type];
        lines.push(`  • ${label}${t.counts[type] > 1 ? ` (${t.counts[type]})` : ''}: ${items.join('; ')}`);
      }
    }
  }

  if (summary.untouched.length) {
    lines.push('', `Not touched: ${summary.untouched.map((t) => t.name).join(', ')}`);
  }

  if (summary.openItems.length) {
    lines.push('', 'Still open:');
    for (const { entry, topic } of summary.openItems) {
      const where = [topic?.name, summary.range.from !== summary.range.to ? weekdayShort(entry.day) : null]
        .filter(Boolean)
        .join(', ');
      lines.push(`  • [${ENTRY_TYPE_LABELS[entry.type]}] ${entry.text}${where ? ` (${where})` : ''}`);
    }
  }

  return lines.join('\n');
}
