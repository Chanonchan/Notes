import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CalendarGrid } from '../components/CalendarGrid';
import { DayTimeline } from '../components/DayTimeline';
import { GroupLabel, ListGroup, ListRow, ScreenHeader } from '../components/List';
import { Chip } from '../components/ui';
import { countEntriesByDay } from '../db';
import { useQuery } from '../hooks/useDb';
import { useTheme } from '../hooks/useTheme';
import { formatDayLong, formatRelativeDay, fromDayKey, monthName, todayKey, toDayKey } from '../services/dates';
import type { TabScreenProps } from '../types/navigation';

export function HistoryScreen({ navigation }: TabScreenProps<'History'>) {
  const t = useTheme();
  const today = todayKey();
  const [selected, setSelected] = useState(today);
  const [cursor, setCursor] = useState(() => {
    const d = fromDayKey(today);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const from = toDayKey(new Date(cursor.year, cursor.month, 1));
  const to = toDayKey(new Date(cursor.year, cursor.month + 1, 0));
  const counts = useQuery((db) => countEntriesByDay(db, from, to), [from, to]).data ?? new Map();
  const loggedDays = counts.size;

  const shift = (n: number) =>
    setCursor(({ year, month }) => {
      const d = new Date(year, month + n, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  const isCurrentMonth = from <= today && today <= to;

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.container}>
      <ScreenHeader title="History" subtitle={`${loggedDays} ${loggedDays === 1 ? 'day' : 'days'} logged in ${monthName(cursor.month)}`} />
      <View style={styles.body}>
        <ListGroup style={styles.calendarCard}>
          <View>
            <View style={styles.monthRow}>
              <Chip label="◀" accessibilityLabel="Previous month" onPress={() => shift(-1)} />
              <Text style={[styles.month, { color: t.text }]}>
                {monthName(cursor.month)} {cursor.year}
              </Text>
              <Chip label="▶" accessibilityLabel="Next month" onPress={() => to < today && shift(1)} />
            </View>
            <CalendarGrid
              year={cursor.year}
              month={cursor.month}
              counts={counts}
              selected={selected}
              today={today}
              onSelect={setSelected}
            />
            {!isCurrentMonth ? (
              <Chip
                label="Jump to today"
                onPress={() => {
                  const d = fromDayKey(today);
                  setCursor({ year: d.getFullYear(), month: d.getMonth() });
                  setSelected(today);
                }}
              />
            ) : null}
          </View>
        </ListGroup>

        <GroupLabel right={selected !== today ? formatDayLong(selected) : undefined}>{formatRelativeDay(selected, today)}</GroupLabel>
        <ListGroup>
          <ListRow
            icon="add-circle"
            title="Add entry to this day"
            subtitle="Forgot something? Log it here."
            onPress={() => navigation.navigate('EntryEdit', { day: selected })}
          />
        </ListGroup>
        <DayTimeline
          day={selected}
          onEdit={(e) => navigation.navigate('EntryEdit', { entryId: e.id })}
          emptyText="Nothing logged this day."
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 48 },
  body: { paddingHorizontal: 16 },
  calendarCard: { padding: 12 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  month: { fontSize: 18, fontWeight: '700' },
});
