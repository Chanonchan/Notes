import { ENTRY_TYPES, type Entry, type EntryType, type Topic } from '../../types';
import type { OpenItem, Summarizer, Summary, SummaryInput, TopicSummary } from './types';

/** Still waiting: in progress first, then planned. Blocked is a closed record with its own section. */
const OPEN_TYPES: EntryType[] = ['in_progress', 'next'];

const emptyByType = <T>(make: () => T) =>
  Object.fromEntries(ENTRY_TYPES.map((t) => [t, make()])) as Record<EntryType, T>;

const norm = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');

function summarizeTopic(topic: Topic | null, entries: Entry[]): TopicSummary {
  const counts = emptyByType(() => 0);
  const items = emptyByType<string[]>(() => []);
  const itemIds = emptyByType<number[]>(() => []);
  const seen = emptyByType(() => new Set<string>());
  const days = new Set<string>();
  let totalMinutes = 0;

  for (const e of entries) {
    counts[e.type]++;
    days.add(e.day);
    totalMinutes += e.durationMinutes ?? 0;
    const key = norm(e.text);
    if (!seen[e.type].has(key)) {
      seen[e.type].add(key);
      items[e.type].push(e.text);
      itemIds[e.type].push(e.id);
    }
  }
  return { topic, entryCount: entries.length, days: [...days].sort(), totalMinutes, counts, items, itemIds };
}

/**
 * An open entry (Next / In progress / Blocked) still counts as waiting unless
 * it was carried over, or a later entry in the same topic with the same text
 * marks it Done.
 */
function findOpenItems(input: SummaryInput, byId: Map<number, Topic>): OpenItem[] {
  const sorted = [...input.entries].sort((a, b) => a.createdAt - b.createdAt || a.id - b.id);
  const latestByKey = new Map<string, Entry>();
  for (const e of sorted) latestByKey.set(`${e.topicId ?? ''}|${norm(e.text)}`, e);

  return sorted
    .filter((e) => OPEN_TYPES.includes(e.type) && !input.continuedIds.has(e.id))
    .filter((e) => latestByKey.get(`${e.topicId ?? ''}|${norm(e.text)}`) === e)
    .sort((a, b) => OPEN_TYPES.indexOf(a.type) - OPEN_TYPES.indexOf(b.type) || a.createdAt - b.createdAt)
    .map((entry) => ({ entry, topic: entry.topicId != null ? (byId.get(entry.topicId) ?? null) : null }));
}

export function summarizeWithRules(input: SummaryInput): Summary {
  const byId = new Map(input.topics.map((t) => [t.id, t]));
  const groups = new Map<number | null, Entry[]>();
  for (const e of input.entries) {
    const key = e.topicId != null && byId.has(e.topicId) ? e.topicId : null;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  const topics = [...groups]
    .map(([id, list]) => summarizeTopic(id === null ? null : byId.get(id)!, list))
    .sort(
      (a, b) =>
        (a.topic === null ? 1 : 0) - (b.topic === null ? 1 : 0) ||
        b.totalMinutes - a.totalMinutes ||
        b.entryCount - a.entryCount ||
        (a.topic?.name ?? '').localeCompare(b.topic?.name ?? ''),
    );

  const untouched = input.topics
    .filter((t) => !t.archived && !groups.has(t.id) && t.createdAt <= endOfDay(input.range.to))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    range: input.range,
    totals: {
      entries: input.entries.length,
      minutes: input.entries.reduce((s, e) => s + (e.durationMinutes ?? 0), 0),
      days: new Set(input.entries.map((e) => e.day)).size,
      topics: topics.filter((t) => t.topic).length,
    },
    topics,
    untouched,
    openItems: findOpenItems(input, byId),
    blocked: closedOfType(input, byId, 'blocked'),
    onHold: closedOfType(input, byId, 'on_hold'),
    source: 'rules',
  };
}

function closedOfType(input: SummaryInput, byId: Map<number, Topic>, type: EntryType): OpenItem[] {
  return input.entries
    .filter((e) => e.type === type)
    .sort((a, b) => a.createdAt - b.createdAt || a.id - b.id)
    .map((entry) => ({ entry, topic: entry.topicId != null ? (byId.get(entry.topicId) ?? null) : null }));
}

function endOfDay(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

export const ruleBasedSummarizer: Summarizer = {
  id: 'rules',
  summarize: async (input) => summarizeWithRules(input),
};
