import { listEntriesInRange, listTopics } from '../../db';
import type { Db } from '../../db/client';
import { ruleBasedSummarizer } from './ruleBased';
import type { Summarizer, Summary, SummaryInput, SummaryRange } from './types';

export * from './types';
export { formatSummaryText, formatTopicLine } from './formatText';
export { formatRange, rangeFor, rangeLength, shiftRange } from './ranges';
export { summarizeWithRules } from './ruleBased';

/**
 * The summarizer the app uses. To plug in an AI summarizer later, implement
 * `Summarizer` (e.g. services/summary/claude.ts calling the Claude API with
 * the same SummaryInput) and return it here — screens don't change.
 */
export function getSummarizer(): Summarizer {
  return ruleBasedSummarizer;
}

export async function loadSummaryInput(db: Db, range: SummaryRange): Promise<SummaryInput> {
  const [entries, topics, continued] = await Promise.all([
    listEntriesInRange(db, range.from, range.to),
    listTopics(db, { includeArchived: true }),
    db.all<{ id: number }>(
      `SELECT DISTINCT carried_from_id AS id FROM entries
       WHERE carried_from_id IS NOT NULL AND day <= ?`,
      [range.to],
    ),
  ]);
  return { range, entries, topics, continuedIds: new Set(continued.map((r) => r.id)) };
}

export async function buildSummary(db: Db, range: SummaryRange, summarizer = getSummarizer()): Promise<Summary> {
  return summarizer.summarize(await loadSummaryInput(db, range));
}
