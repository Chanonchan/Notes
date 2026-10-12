import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';
import { formatDayLong, fromDayKey, monthName, todayKey } from '../services/dates';
import type { DayKey } from '../types';
import { CalendarGrid } from './CalendarGrid';
import { Button, Chip } from './ui';

/** Pick a From and To day with a month calendar. */
export function DateRangeModal({
  visible,
  from: initialFrom,
  to: initialTo,
  onApply,
  onClose,
}: {
  visible: boolean;
  from: DayKey;
  to: DayKey;
  onApply: (from: DayKey, to: DayKey) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const today = todayKey();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [field, setField] = useState<'from' | 'to'>('from');
  const [cursor, setCursor] = useState(() => monthOf(initialFrom));

  useEffect(() => {
    if (!visible) return;
    setFrom(initialFrom);
    setTo(initialTo);
    setField('from');
    setCursor(monthOf(initialFrom));
  }, [visible, initialFrom, initialTo]);

  const pick = (day: DayKey) => {
    if (field === 'from') {
      setFrom(day);
      if (day > to) setTo(day);
      setField('to');
    } else if (day < from) {
      setFrom(day);
    } else {
      setTo(day);
    }
  };

  const shift = (n: number) =>
    setCursor(({ year, month }) => {
      const d = new Date(year, month + n, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: t.card }]}>
        <Text style={[styles.title, { color: t.text }]}>Custom range</Text>
        <View style={styles.fields}>
          {(['from', 'to'] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => {
                setField(f);
                setCursor(monthOf(f === 'from' ? from : to));
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: field === f }}
              style={[styles.field, { borderColor: field === f ? t.primary : t.border, backgroundColor: t.bg }]}
            >
              <Text style={{ color: t.muted, fontSize: 12, fontWeight: '700' }}>{f === 'from' ? 'FROM' : 'TO'}</Text>
              <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>{formatDayLong(f === 'from' ? from : to)}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.monthRow}>
          <Chip label="◀" accessibilityLabel="Previous month" onPress={() => shift(-1)} />
          <Text style={[styles.month, { color: t.text }]}>
            {monthName(cursor.month)} {cursor.year}
          </Text>
          <Chip label="▶" accessibilityLabel="Next month" onPress={() => shift(1)} />
        </View>
        <CalendarGrid
          year={cursor.year}
          month={cursor.month}
          counts={new Map()}
          selected={field === 'from' ? from : to}
          today={today}
          onSelect={pick}
        />
        <View style={styles.actions}>
          <Button label="Cancel" kind="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button label="Apply" onPress={() => onApply(from, to)} style={{ flex: 1 }} />
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
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 28 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  fields: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  field: { flex: 1, borderWidth: 2, borderRadius: 12, padding: 10, gap: 2 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  month: { fontSize: 17, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
});
