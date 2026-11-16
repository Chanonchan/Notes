import { buildXlsx, type Cell, type Sheet } from '../export/xlsx';
import { ENTRY_TYPE_LABELS, type EntryType } from '../../types';
import { formatRange } from './ranges';
import type { Summary } from './types';

// Same order as the text summary, with Blocked last.
const TYPE_ORDER: EntryType[] = ['done', 'on_hold', 'in_progress', 'next', 'blocked'];
const COUNT_COLUMNS: EntryType[] = ['done', 'on_hold', 'in_progress', 'next', 'blocked'];

const h = (value: string): Cell => ({ value, style: 'header' });
const bold = (value: string): Cell => ({ value, style: 'bold' });
const duration = (minutes: number): Cell => (minutes ? { value: minutes, style: 'duration' } : null);
const date = (day: string | null | undefined): Cell => (day ? { value: day, style: 'date' } : null);
const wrap = (value: string): Cell => ({ value, style: 'wrap' });

/** The summary as spreadsheet tabs: an overview by topic, every item, and what's blocked or still open. */
export function summaryToSheets(summary: Summary): Sheet[] {
  const { totals } = summary;
  const singleDay = summary.range.from === summary.range.to;

  // 1. Overview: totals, then one row per topic.
  const overview: Cell[][] = [
    [{ value: 'Work summary', style: 'title' }],
    [formatRange(summary.range)],
    [],
    [bold('Entries'), totals.entries],
    [bold('Topics'), totals.topics],
  ];
  if (!singleDay) overview.push([bold('Days'), totals.days]);
  overview.push([bold('Time'), duration(totals.minutes) ?? '—']);
  if (summary.untouched.length) overview.push([bold('Not touched'), summary.untouched.map((t) => t.name).join(', ')]);
  overview.push([]);
  overview.push([h('Topic'), h('Entries'), h('Days'), h('Time'), ...COUNT_COLUMNS.map((t) => h(ENTRY_TYPE_LABELS[t]))]);
  for (const t of summary.topics) {
    overview.push([
      t.topic?.name ?? 'No topic',
      t.entryCount,
      t.days.length,
      duration(t.totalMinutes),
      ...COUNT_COLUMNS.map((type) => t.counts[type] || null),
    ]);
  }
  if (summary.topics.length > 1) {
    overview.push([
      bold('Total'),
      totals.entries,
      singleDay ? 1 : totals.days,
      duration(totals.minutes),
      ...COUNT_COLUMNS.map((type) => summary.topics.reduce((s, t) => s + t.counts[type], 0) || null),
    ]);
  }

  // 2. Every item, grouped by topic then status (de-duplicated like the on-screen summary).
  const items: Cell[][] = [[h('Topic'), h('Status'), h('Item'), h('Starred')]];
  for (const t of summary.topics) {
    for (const type of TYPE_ORDER) {
      t.items[type].forEach((text, i) => {
        const starred = t.starredIds.includes(t.itemIds[type][i]);
        items.push([t.topic?.name ?? 'No topic', ENTRY_TYPE_LABELS[type], wrap(text), starred ? '★' : null]);
      });
    }
  }

  // 3. Blocked and still-open work, with the day it was logged and any deadline.
  const open: Cell[][] = [[h('Status'), h('Item'), h('Topic'), h('Logged'), h('Due')]];
  for (const { entry, topic } of [...summary.blocked, ...summary.openItems]) {
    open.push([ENTRY_TYPE_LABELS[entry.type], wrap(entry.text), topic?.name ?? 'No topic', date(entry.day), date(entry.dueDay)]);
  }

  const sheets: Sheet[] = [
    { name: 'Summary', rows: overview, widths: [24, 10, 8, 10, 8, 9, 12, 8, 9] },
    { name: 'Items', rows: items, widths: [24, 12, 60, 8], freezeRows: 1 },
  ];
  if (open.length > 1) sheets.push({ name: 'Blocked & open', rows: open, widths: [12, 60, 24, 16, 16], freezeRows: 1 });
  return sheets;
}

export function formatSummaryXlsx(summary: Summary): Uint8Array {
  return buildXlsx(summaryToSheets(summary));
}

/** e.g. "daylog-summary-2026-10-05-to-2026-10-11.xlsx" */
export function summaryFilename(summary: Summary): string {
  const { from, to } = summary.range;
  return `daylog-summary-${from === to ? from : `${from}-to-${to}`}.xlsx`;
}
