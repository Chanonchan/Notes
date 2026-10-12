import { Text, View } from 'react-native';

import { groupByTopic, useDayEntries, useTopics } from '../hooks/useData';
import { useEntryActions } from '../hooks/useEntryActions';
import { useTheme } from '../hooks/useTheme';
import { formatDuration } from '../services/dates';
import type { DayKey, Entry } from '../types';
import { EntryRow } from './EntryRow';
import { GroupLabel, ListGroup } from './List';

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
  if (!entries.length) {
    return <Text style={{ color: t.muted, fontSize: 15, paddingVertical: 24, textAlign: 'center' }}>{emptyText}</Text>;
  }

  return (
    <View>
      {groupByTopic(entries, byId).map(({ topic, entries: list }) => {
        const minutes = list.reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
        return (
          <View key={topic?.id ?? 'none'}>
            <GroupLabel dot={topic?.color ?? t.muted} right={`${list.length}${minutes ? ` · ${formatDuration(minutes)}` : ''}`}>
              {topic?.name ?? 'No topic'}
            </GroupLabel>
            <ListGroup>
              {list.map((e) => (
                <EntryRow key={e.id} entry={e} onPress={() => onEdit(e)} onTypePress={() => actions.open(e)} />
              ))}
            </ListGroup>
          </View>
        );
      })}
      {actions.menu}
    </View>
  );
}
