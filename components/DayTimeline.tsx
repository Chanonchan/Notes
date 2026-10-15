import { Text, View } from 'react-native';

import { groupByTopic, useDayEntries, useTopics } from '../hooks/useData';
import { useEntryActions } from '../hooks/useEntryActions';
import { useTheme } from '../hooks/useTheme';
import { formatDuration } from '../services/dates';
import { setStatus } from '../db';
import { useMutation } from '../hooks/useDb';
import type { DayKey, Entry, EntryType } from '../types';
import { ENTRY_INSET, EntryRow } from './EntryRow';
import { GroupLabel, ListGroup } from './List';

/** A day's entries grouped by topic, with edit / type change / delete. */
export function DayTimeline({
  day,
  onEdit,
  emptyText = 'Nothing logged yet.',
  excludeTypes = [],
  onChecked,
}: {
  day: DayKey;
  onEdit: (entry: Entry) => void;
  emptyText?: string;
  /** Types shown elsewhere (e.g. Next steps in Today's plan box). */
  excludeTypes?: EntryType[];
  /** Called after an open item is ticked off (e.g. to offer Undo). */
  onChecked?: (entry: Entry) => void;
}) {
  const t = useTheme();
  const { entries: all, loading } = useDayEntries(day);
  const entries = all.filter((e) => !excludeTypes.includes(e.type));
  const markDone = useMutation((db, id: number) => setStatus(db, id, 'done'));
  const check = async (e: Entry) => {
    await markDone(e.id);
    onChecked?.(e);
  };
  const { byId } = useTopics(true);
  const actions = useEntryActions();

  if (loading) return null;
  if (!entries.length) {
    if (!emptyText) return null;
    return <Text style={{ color: t.muted, fontSize: 15, paddingVertical: 24, textAlign: 'center' }}>{emptyText}</Text>;
  }

  return (
    <View>
      {groupByTopic(entries, byId).map(({ topic, entries: list }) => {
        const minutes = list.reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
        return (
          <View key={topic?.id ?? 'none'}>
            <GroupLabel right={minutes ? formatDuration(minutes) : undefined}>
              {topic?.name ?? 'No topic'}
            </GroupLabel>
            <ListGroup inset={ENTRY_INSET}>
              {list.map((e) => (
                <EntryRow
                  key={e.id}
                  entry={e}
                  onPress={() => onEdit(e)}
                  onTypePress={() => actions.open(e)}
                  onCheck={e.type === 'in_progress' || e.type === 'next' ? () => check(e) : undefined}
                />
              ))}
            </ListGroup>
          </View>
        );
      })}
      {actions.menu}
    </View>
  );
}
