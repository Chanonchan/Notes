import { StyleSheet, Text, View } from 'react-native';

import type { TopicStats } from '../db';
import { useTheme } from '../hooks/useTheme';
import type { EntryType } from '../types';

const PARTS: { type: EntryType; key: keyof TopicStats; label: string }[] = [
  { type: 'done', key: 'doneCount', label: 'done' },
  { type: 'in_progress', key: 'inProgressCount', label: 'working' },
  { type: 'blocked', key: 'blockedCount', label: 'blocked' },
  { type: 'next', key: 'nextCount', label: 'planned' },
];

/** How a topic's work is going: a stacked bar plus "3 done · 1 working · 1 blocked". */
export function TopicProgress({ stats, large }: { stats: TopicStats; large?: boolean }) {
  const t = useTheme();
  const parts = PARTS.map((p) => ({ ...p, n: stats[p.key] as number })).filter((p) => p.n > 0);
  const total = parts.reduce((s, p) => s + p.n, 0);
  if (!total) return null;
  const pct = Math.round((stats.doneCount / total) * 100);
  const summary = parts.map((p) => `${p.n} ${p.label}`).join(', ');

  return (
    <View style={[styles.wrap, large && { gap: 8 }]} accessible accessibilityLabel={`Progress: ${pct}% done. ${summary}`}>
      <View style={[styles.bar, { backgroundColor: t.chip, height: large ? 10 : 6 }]}>
        {parts.map((p) => (
          <View key={p.type} style={{ flex: p.n, backgroundColor: t.types[p.type] }} />
        ))}
      </View>
      <View style={styles.legend}>
        {large ? <Text style={[styles.pct, { color: t.text }]}>{pct}% done</Text> : null}
        {parts.map((p) => (
          <View key={p.type} style={styles.item}>
            <View style={[styles.dot, { backgroundColor: t.types[p.type] }]} />
            <Text style={{ color: t.muted, fontSize: large ? 14 : 13 }}>
              {p.n} {p.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, marginTop: 6 },
  bar: { flexDirection: 'row', borderRadius: 5, overflow: 'hidden', gap: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pct: { fontSize: 14, fontWeight: '700' },
});
