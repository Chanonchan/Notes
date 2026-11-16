import { buildXlsx, type Cell, type Sheet } from '../export/xlsx';
import { ENTRY_TYPE_LABELS, type EntryType } from '../../types';
import { formatRange } from './ranges';
import type { Summary } from './types';

// Same order as the text summary, with Blocked last.
const TYPE_ORDER: EntryType[] = ['done', 'on_hold', 'in_progress', 'next', 'blocked'];

/**
 * The summary as one simple sheet: each topic in bold, its items listed
 * underneath as "- item" with their status and tags beside them.
 */
export function summaryToSheets(summary: Summary): Sheet[] {
  const rows: Cell[][] = [[{ value: 'Work summary', style: 'title' }], [formatRange(summary.range)]];
  if (!summary.topics.length) rows.push([], ['Nothing logged.']);
  for (const t of summary.topics) {
    rows.push([], [{ value: t.topic?.name ?? 'No topic', style: 'bold' }, { value: 'Status', style: 'bold' }, { value: 'Tags', style: 'bold' }]);
    for (const type of TYPE_ORDER) {
      t.items[type].forEach((text, i) => {
        const tags = t.itemTags[type][i] ?? [];
        rows.push([`- ${text}`, ENTRY_TYPE_LABELS[type], tags.length ? tags.map((x) => `#${x}`).join(' ') : null]);
      });
    }
  }
  return [{ name: 'Summary', rows, widths: [44, 12, 24] }];
}

export function formatSummaryXlsx(summary: Summary): Uint8Array {
  return buildXlsx(summaryToSheets(summary));
}

/** e.g. "daylog-summary-2026-10-05-to-2026-10-11.xlsx" */
export function summaryFilename(summary: Summary): string {
  const { from, to } = summary.range;
  return `daylog-summary-${from === to ? from : `${from}-to-${to}`}.xlsx`;
}
