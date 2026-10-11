import { useEffect, useMemo, useState } from 'react';

import { getLastTopicId, listEntriesByDay, listTopics, recentTextsByTopic } from '../db';
import { buildSuggestIndex } from '../services/topicSuggest';
import type { DayKey, Entry, Topic } from '../types';
import { useQuery } from './useDb';

export function useTopics(includeArchived = false) {
  const { data } = useQuery((db) => listTopics(db, { includeArchived }), [includeArchived]);
  const topics = data ?? [];
  const byId = useMemo(() => new Map(topics.map((t) => [t.id, t] as const)), [topics]);
  return { topics, byId, loading: data === undefined };
}

export function useDayEntries(day: DayKey) {
  const { data } = useQuery((db) => listEntriesByDay(db, day), [day]);
  return { entries: data ?? [], loading: data === undefined };
}

export function useLastTopicId() {
  return useQuery((db) => getLastTopicId(db)).data;
}

/** Group entries by topic, keeping first-appearance order; untopiced last. */
export function groupByTopic(entries: Entry[], byId: Map<number, Topic>) {
  const groups = new Map<number | null, Entry[]>();
  for (const e of entries) {
    const key = e.topicId != null && byId.has(e.topicId) ? e.topicId : null;
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }
  const ordered = [...groups].sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : 0));
  return ordered.map(([topicId, list]) => ({ topic: topicId === null ? null : byId.get(topicId)!, entries: list }));
}

/** Suggested topic id for `text`, debounced. */
export function useTopicSuggestion(text: string): number | null {
  const { data: corpus } = useQuery(async (db) => {
    const [topics, texts] = await Promise.all([listTopics(db), recentTextsByTopic(db)]);
    return topics.map((t) => ({ topicId: t.id, name: t.name, texts: texts.get(t.id) ?? [] }));
  });
  const index = useMemo(() => (corpus ? buildSuggestIndex(corpus) : null), [corpus]);
  const [suggestion, setSuggestion] = useState<number | null>(null);

  useEffect(() => {
    if (!index || text.trim().length < 3) {
      setSuggestion(null);
      return;
    }
    const t = setTimeout(() => setSuggestion(index.suggest(text)[0]?.topicId ?? null), 250);
    return () => clearTimeout(t);
  }, [index, text]);

  return suggestion;
}
