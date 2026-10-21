import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';
import { toDayKey } from '../services/dates';
import type { DayKey } from '../types';

const WEEKDAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Month grid (weeks start Monday). Days with entries get a dot; future days are disabled unless `allowFuture`. */
export function CalendarGrid({
  year,
  month,
  counts,
  selected,
  today,
  onSelect,
  allowFuture = false,
}: {
  year: number;
  month: number;
  counts: Map<DayKey, number>;
  selected: DayKey;
  today: DayKey;
  onSelect: (day: DayKey) => void;
  /** For picking deadlines. */
  allowFuture?: boolean;
}) {
  const t = useTheme();
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (DayKey | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => toDayKey(new Date(year, month, i + 1))),
  ];
  while (cells.length % 7) cells.push(null);

  return (
    <View>
      <View style={styles.week}>
        {WEEKDAY_HEADERS.map((d, i) => (
          <Text key={i} style={[styles.header, { color: i === 6 ? t.muted : t.text, opacity: 0.7 }]}>
            {d}
          </Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, w) => (
        <View key={w} style={styles.week}>
          {cells.slice(w * 7, w * 7 + 7).map((day, i) => {
            if (!day) return <View key={i} style={styles.cell} />;
            const n = counts.get(day) ?? 0;
            const isSel = day === selected;
            const isToday = day === today;
            const future = !allowFuture && day > today;
            return (
              <Pressable
                key={day}
                disabled={future}
                onPress={() => onSelect(day)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel, disabled: future }}
                accessibilityLabel={`${day}${n ? `, ${n} entries` : ''}`}
                style={styles.cell}
              >
                <View
                  style={[
                    styles.circle,
                    isSel && { backgroundColor: t.primary },
                    !isSel && isToday && { borderWidth: 2, borderColor: t.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.num,
                      { color: isSel ? t.onPrimary : future ? t.border : t.text, fontWeight: isToday || isSel ? '800' : '500' },
                    ]}
                  >
                    {Number(day.slice(8))}
                  </Text>
                </View>
                <View style={[styles.dot, { backgroundColor: n ? t.primary : 'transparent' }]} />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  week: { flexDirection: 'row' },
  header: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '700', paddingVertical: 6 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 3, minHeight: 52 },
  circle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  num: { fontSize: 16 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
});
