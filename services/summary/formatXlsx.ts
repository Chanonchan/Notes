import { buildXlsx, type Cell, type Sheet } from '../export/xlsx';
import { ENTRY_TYPE_LABELS, type EntryType } from '../../types';
import { formatRange } from './ranges';
import type { Summary } from './types';

// Same order as the text summary, with Blocked last.
const TYPE_ORDER: EntryType[] = ['done', 'on_hold', 'in_progress', 'next', 'blocked'];

const HEADERS = ['Status', 'Date', 'Time', 'Tags'].map((value): Cell => ({ value, style: 'bold' }));

/**
 * The summary as one simple sheet: each topic in bold, then every piece of
 * work logged under it as "- item" with its status, date, time and tags.
 */
export function summaryToSheets(summary: Summary): Sheet[] {
  const rows: Cell[][] = [[{ value: 'Work summary', style: 'title' }], [formatRange(summary.range)]];
  if (!summary.topics.length) rows.push([], ['Nothing logged.']);
  for (const t of summary.topics) {
    rows.push([], [{ value: t.topic?.name ?? 'No topic', style: 'bold' }, ...HEADERS]);
    if (t.tags.length) rows.push([`Project tags: ${t.tags.join(', ')}`]);
    // By status, then oldest first (entries are already in time order).
    const entries = [...t.entries].sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));
    for (const e of entries) {
      const at = new Date(e.createdAt);
      rows.push([
        `- ${e.text}`,
        ENTRY_TYPE_LABELS[e.type],
        { value: e.day, style: 'date' },
        { value: at.getHours() * 60 + at.getMinutes(), style: 'time' },
        e.tags.length ? e.tags.map((x) => `#${x}`).join(' ') : null,
      ]);
    }
  }
  return [{ name: 'Summary', rows, widths: [34, 11, 15, 6, 16] }];
}

export function formatSummaryXlsx(summary: Summary): Uint8Array {
  return buildXlsx(summaryToSheets(summary));
}

/** e.g. "daylog-summary-2026-10-05-to-2026-10-11.xlsx" */
export function summaryFilename(summary: Summary): string {
  const { from, to } = summary.range;
  return `daylog-summary-${from === to ? from : `${from}-to-${to}`}.xlsx`;
}
