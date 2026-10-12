import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalendarGrid } from '../components/CalendarGrid';
import { DayTimeline } from '../components/DayTimeline';
import { Button, Card, Chip } from '../components/ui';
import { countEntriesByDay } from '../db';
import { useQuery } from '../hooks/useDb';
import { useTheme } from '../hooks/useTheme';
import { formatRelativeDay, fromDayKey, monthName, todayKey, toDayKey } from '../services/dates';
import type { TabScreenProps } from '../types/navigation';

export function HistoryScreen({ navigation }: TabScreenProps<'History'>) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
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
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={[styles.container, { paddingTop: insets.top + 12 }]}>
      <Text style={[styles.title, { color: t.text }]}>History</Text>

      <Card>
        <View style={styles.monthRow}>
          <Chip label="◀" accessibilityLabel="Previous month" onPress={() => shift(-1)} />
          <View style={styles.monthLabel}>
            <Text style={[styles.month, { color: t.text }]}>
              {monthName(cursor.month)} {cursor.year}
            </Text>
            <Text style={{ color: t.muted, fontSize: 13 }}>
              {loggedDays} {loggedDays === 1 ? 'day' : 'days'} logged
            </Text>
          </View>
          <Chip
            label="▶"
            accessibilityLabel="Next month"
            onPress={() => to < today && shift(1)}
          />
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
      </Card>

      <View style={styles.dayHeader}>
        <Text style={[styles.dayTitle, { color: t.text }]}>{formatRelativeDay(selected, today)}</Text>
        {selected !== today ? <Text style={{ color: t.muted }}>{selected}</Text> : null}
      </View>
      <Button
        label="+ Add entry to this day"
        kind="secondary"
        onPress={() => navigation.navigate('EntryEdit', { day: selected })}
        style={styles.add}
      />
      <DayTimeline
        day={selected}
        onEdit={(e) => navigation.navigate('EntryEdit', { entryId: e.id })}
        emptyText="Nothing logged this day. Forgot something? Add it above."
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 12 },
  monthRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  monthLabel: { flex: 1, alignItems: 'center' },
  month: { fontSize: 18, fontWeight: '700' },
  dayHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 },
  dayTitle: { fontSize: 20, fontWeight: '700' },
  add: { marginBottom: 12 },
});
