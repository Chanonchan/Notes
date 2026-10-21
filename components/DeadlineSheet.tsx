import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../hooks/useTheme';
import { formatDayLong, fromDayKey, monthName, todayKey } from '../services/dates';
import { deadlineChoices } from '../services/deadline';
import type { DayKey } from '../types';
import { CalendarGrid } from './CalendarGrid';
import { Button, Chip } from './ui';

/** Pick a deadline: quick choices or any day on the calendar; or clear it. */
export function DeadlineSheet({
  visible,
  value,
  onPick,
  onClose,
}: {
  visible: boolean;
  value: DayKey | null;
  /** null = no deadline. */
  onPick: (day: DayKey | null) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const today = todayKey();
  const [day, setDay] = useState<DayKey>(value ?? today);
  const [cursor, setCursor] = useState(() => monthOf(value ?? today));

  useEffect(() => {
    if (!visible) return;
    setDay(value ?? today);
    setCursor(monthOf(value ?? today));
  }, [visible, value, today]);

  const shift = (n: number) =>
    setCursor(({ year, month }) => {
      const d = new Date(year, month + n, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: t.sheet, borderColor: t.sheetEdge, paddingBottom: insets.bottom + 16 }]}>
        <Text style={[styles.title, { color: t.text }]}>Deadline</Text>
        <Text style={{ color: t.muted, fontSize: 15, marginBottom: 10 }}>{formatDayLong(day)}</Text>
        <View style={styles.quick}>
          {deadlineChoices(today).map((c) => (
            <Chip
              key={c.label}
              label={c.label}
              selected={day === c.day}
              onPress={() => {
                setDay(c.day);
                setCursor(monthOf(c.day));
              }}
            />
          ))}
        </View>
        <View style={styles.monthRow}>
          <Chip label="◀" accessibilityLabel="Previous month" onPress={() => shift(-1)} />
          <Text style={[styles.month, { color: t.text }]}>
            {monthName(cursor.month)} {cursor.year}
          </Text>
          <Chip label="▶" accessibilityLabel="Next month" onPress={() => shift(1)} />
        </View>
        <CalendarGrid year={cursor.year} month={cursor.month} counts={new Map()} selected={day} today={today} onSelect={setDay} allowFuture />
        <View style={styles.actions}>
          {value ? <Button label="No deadline" kind="secondary" onPress={() => onPick(null)} style={{ flex: 1 }} /> : null}
          {!value ? <Button label="Cancel" kind="secondary" onPress={onClose} style={{ flex: 1 }} /> : null}
          <Button label="Set deadline" onPress={() => onPick(day)} style={{ flex: 1 }} />
        </View>
      </View>
    </Modal>
  );
}

function monthOf(day: DayKey) {
  const d = fromDayKey(day);
  return { year: d.getFullYear(), month: d.getMonth() };
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    padding: 16,
  },
  title: { fontSize: 20, fontWeight: '800' },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  month: { fontSize: 17, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
});
