import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';
import { ENTRY_TYPE_LABELS, type EntryType } from '../types';

/** Two rows so five labels fit on a phone: everyday types first, then the closing ones. */
const ROWS: EntryType[][] = [
  ['done', 'in_progress', 'next'],
  ['blocked', 'on_hold'],
];

/** Segmented control for the entry type. */
export function TypeSelector({ value, onChange }: { value: EntryType; onChange: (t: EntryType) => void }) {
  const t = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: t.chip }]} accessibilityRole="radiogroup">
      {ROWS.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((type) => {
            const selected = value === type;
            return (
              <Pressable
                key={type}
                onPress={() => onChange(type)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[styles.segment, selected && [styles.selected, { backgroundColor: t.raised }]]}
              >
                <Text style={[styles.label, { color: selected ? t.types[type] : t.muted }]} numberOfLines={1} adjustsFontSizeToFit>
                  {ENTRY_TYPE_LABELS[type]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: 14, padding: 3, gap: 3 },
  row: { flexDirection: 'row', gap: 3 },
  segment: { flex: 1, minHeight: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  selected: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  label: { fontSize: 14, fontWeight: '700' },
});
