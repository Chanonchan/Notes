import type { DayKey, Entry, EntryType, Topic } from '../../types';

export type RangeKind = 'day' | 'week' | 'month' | 'custom';

export interface SummaryRange {
  kind: RangeKind;
  from: DayKey;
  to: DayKey;
}

/** Everything a summarizer needs; gathered from the DB by `loadSummaryInput`. */
export interface SummaryInput {
  range: SummaryRange;
  /** Entries with from <= day <= to. */
  entries: Entry[];
  /** All topics, archived included (entries may reference archived ones). */
  topics: Topic[];
  /** Ids of entries that were continued later (carried over) — not "still open". */
  continuedIds: Set<number>;
}

export interface TopicSummary {
  /** null = entries without a topic. */
  topic: Topic | null;
  entryCount: number;
  /** Distinct days with entries, ascending. */
  days: DayKey[];
  totalMinutes: number;
  counts: Record<EntryType, number>;
  /** Entry texts per type, in chronological order, de-duplicated. */
  items: Record<EntryType, string[]>;
  /** Entry id behind each item (same order as `items`), for opening it to edit. */
  itemIds: Record<EntryType, number[]>;
}

export interface OpenItem {
  entry: Entry;
  topic: Topic | null;
}

export interface Summary {
  range: SummaryRange;
  totals: { entries: number; minutes: number; days: number; topics: number };
  /** Busiest first: by time, then entry count. */
  topics: TopicSummary[];
  /** Active (non-archived) topics with no entries in the range. */
  untouched: Topic[];
  /** In progress / Next entries in the range not resolved later. */
  openItems: OpenItem[];
  /** Blocked entries in the range, oldest first (their own section). */
  blocked: OpenItem[];
  /** Which summarizer produced this (e.g. 'rules', 'claude'). */
  source: string;
}

/**
 * Turns raw entries into a Summary. The rule-based implementation is the
 * default; an AI one (e.g. Claude API) can implement the same interface and
 * be swapped in from services/summary/index.ts without touching screens.
 */
export interface Summarizer {
  readonly id: string;
  summarize(input: SummaryInput): Promise<Summary>;
}
