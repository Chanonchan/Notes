import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';
import { formatDuration, formatTime } from '../services/dates';
import { ENTRY_TYPE_LABELS, type Entry } from '../types';

export function EntryRow({
  entry,
  onPress,
  onTypePress,
  showTime = true,
}: {
  entry: Entry;
  onPress: () => void;
  /** Tap on the type badge (or long-press the row) — quick type change. */
  onTypePress: () => void;
  showTime?: boolean;
}) {
  const t = useTheme();
  const color = t.types[entry.type];
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onTypePress}
      accessibilityRole="button"
      accessibilityHint="Opens the entry for editing. Long-press to change its type."
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.chip : 'transparent' }]}
    >
      {showTime ? <Text style={[styles.time, { color: t.muted }]}>{formatTime(entry.createdAt)}</Text> : null}
      <View style={styles.body}>
        <Text style={[styles.text, { color: t.text }]}>{entry.text}</Text>
        {entry.durationMinutes || entry.tags.length ? (
          <Text style={[styles.meta, { color: t.muted }]}>
            {[entry.durationMinutes ? formatDuration(entry.durationMinutes) : null, ...entry.tags.map((x) => `#${x}`)]
              .filter(Boolean)
              .join('  ·  ')}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={onTypePress}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`Type: ${ENTRY_TYPE_LABELS[entry.type]}. Tap to change.`}
        style={[styles.badge, { borderColor: color }]}
      >
        <Text style={[styles.badgeText, { color }]}>{ENTRY_TYPE_LABELS[entry.type]}</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 10 },
  time: { fontSize: 13, width: 42, fontVariant: ['tabular-nums'] },
  body: { flex: 1 },
  text: { fontSize: 16, lineHeight: 22 },
  meta: { fontSize: 13, marginTop: 2 },
  badge: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
});
