import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';
import { ENTRY_TYPES, ENTRY_TYPE_LABELS, type EntryType } from '../types';

/** One-row segmented control for the entry type. */
export function TypeSelector({ value, onChange }: { value: EntryType; onChange: (t: EntryType) => void }) {
  const t = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: t.chip }]} accessibilityRole="radiogroup">
      {ENTRY_TYPES.map((type) => {
        const selected = value === type;
        return (
          <Pressable
            key={type}
            onPress={() => onChange(type)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && { backgroundColor: t.types[type] }]}
          >
            <Text
              style={[styles.label, { color: selected ? '#FFFFFF' : t.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {ENTRY_TYPE_LABELS[type]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: 14, padding: 3, gap: 3 },
  segment: { flex: 1, minHeight: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  label: { fontSize: 14, fontWeight: '700' },
});
