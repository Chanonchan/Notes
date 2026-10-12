import { StyleSheet, Text, View } from 'react-native';

import { groupByTopic, useDayEntries, useTopics } from '../hooks/useData';
import { useEntryActions } from '../hooks/useEntryActions';
import { useTheme } from '../hooks/useTheme';
import { formatDuration } from '../services/dates';
import type { DayKey, Entry } from '../types';
import { EntryRow } from './EntryRow';
import { Card } from './ui';

/** A day's entries grouped by topic, with edit / type change / delete. */
export function DayTimeline({
  day,
  onEdit,
  emptyText = 'Nothing logged yet.',
}: {
  day: DayKey;
  onEdit: (entry: Entry) => void;
  emptyText?: string;
}) {
  const t = useTheme();
  const { entries, loading } = useDayEntries(day);
  const { byId } = useTopics(true);
  const actions = useEntryActions();

  if (loading) return null;
  if (!entries.length) return <Text style={[styles.empty, { color: t.muted }]}>{emptyText}</Text>;

  return (
    <View style={styles.list}>
      {groupByTopic(entries, byId).map(({ topic, entries: list }) => {
        const minutes = list.reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
        return (
          <Card key={topic?.id ?? 'none'} style={styles.card}>
            <View style={styles.header}>
              <View style={[styles.dot, { backgroundColor: topic?.color ?? t.muted }]} />
              <Text style={[styles.topic, { color: t.text }]} numberOfLines={1}>
                {topic?.name ?? 'No topic'}
              </Text>
              <Text style={[styles.stats, { color: t.muted }]}>
                {list.length} {list.length === 1 ? 'entry' : 'entries'}
                {minutes ? ` · ${formatDuration(minutes)}` : ''}
              </Text>
            </View>
            {list.map((e) => (
              <EntryRow key={e.id} entry={e} onPress={() => onEdit(e)} onTypePress={() => actions.open(e)} />
            ))}
          </Card>
        );
      })}
      {actions.menu}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  card: { paddingHorizontal: 8, paddingVertical: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6, paddingBottom: 4 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  topic: { fontSize: 17, fontWeight: '700', flexShrink: 1 },
  stats: { fontSize: 13, marginLeft: 'auto' },
  empty: { fontSize: 15, paddingVertical: 24, textAlign: 'center' },
});
