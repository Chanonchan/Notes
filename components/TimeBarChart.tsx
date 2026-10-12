import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';
import { formatDuration } from '../services/dates';
import type { TopicSummary } from '../services/summary';

const MAX_BARS = 8;

interface Bar {
  key: string;
  name: string;
  color: string;
  minutes: number;
  entries: number;
  days: number;
}

/**
 * Horizontal bars: time per topic. Each bar is labelled with its topic name
 * and value (text in ink colours, never the bar colour), so identity never
 * relies on colour alone. Tap a bar for details. Beyond 8 topics the rest
 * fold into "Other".
 */
export function TimeBarChart({ topics }: { topics: TopicSummary[] }) {
  const t = useTheme();
  const [active, setActive] = useState<string | null>(null);

  const timed = topics.filter((s) => s.totalMinutes > 0).sort((a, b) => b.totalMinutes - a.totalMinutes);
  const untimed = topics.length - timed.length;
  const toBar = (s: TopicSummary): Bar => ({
    key: String(s.topic?.id ?? 'none'),
    name: s.topic?.name ?? 'No topic',
    color: t.muted,
    minutes: s.totalMinutes,
    entries: s.entryCount,
    days: s.days.length,
  });
  let bars = timed.map(toBar);
  if (bars.length > MAX_BARS) {
    const rest = timed.slice(MAX_BARS - 1);
    bars = [
      ...bars.slice(0, MAX_BARS - 1),
      {
        key: 'other',
        name: `Other (${rest.length} topics)`,
        color: t.muted,
        minutes: rest.reduce((s, x) => s + x.totalMinutes, 0),
        entries: rest.reduce((s, x) => s + x.entryCount, 0),
        days: 0,
      },
    ];
  }

  if (!bars.length) {
    return (
      <Text style={{ color: t.muted, fontSize: 14 }}>
        No time recorded in this period. Add a duration (15m, 1h…) to entries to see this chart.
      </Text>
    );
  }

  const max = Math.max(...bars.map((b) => b.minutes));
  const total = bars.reduce((s, b) => s + b.minutes, 0);

  return (
    <View accessibilityRole="summary">
      {bars.map((b) => {
        const isActive = active === b.key;
        const pct = Math.round((b.minutes / total) * 100);
        return (
          <Pressable
            key={b.key}
            onPress={() => setActive(isActive ? null : b.key)}
            accessibilityRole="button"
            accessibilityLabel={`${b.name}: ${formatDuration(b.minutes)}, ${pct}% of time, ${b.entries} entries`}
            style={[styles.row, { opacity: active && !isActive ? 0.45 : 1 }]}
          >
            <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
              {b.name}
            </Text>
            <View style={styles.barLine}>
              {/* The longest bar takes 78% of the row, leaving room for its value label. */}
              <View style={[styles.bar, { backgroundColor: b.color, width: `${(b.minutes / max) * 78}%` }]} />
              <Text style={[styles.value, { color: t.text }]} numberOfLines={1}>
                {formatDuration(b.minutes)}
              </Text>
            </View>
            {isActive ? (
              <Text style={[styles.detail, { color: t.muted }]}>
                {pct}% of tracked time · {b.entries} {b.entries === 1 ? 'entry' : 'entries'}
                {b.days ? ` · ${b.days} ${b.days === 1 ? 'day' : 'days'}` : ''}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
      {untimed > 0 ? (
        <Text style={[styles.note, { color: t.muted }]}>
          {untimed} {untimed === 1 ? 'topic has' : 'topics have'} entries without a duration and {untimed === 1 ? 'is' : 'are'} not shown.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 6 },
  name: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  barLine: { flexDirection: 'row', alignItems: 'center', minHeight: 20 },
  // ≤24px thick, square at the baseline, 4px rounded data end.
  bar: { height: 14, minWidth: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  value: { fontSize: 13, fontWeight: '700', marginLeft: 8, fontVariant: ['tabular-nums'] },
  detail: { fontSize: 13, marginTop: 4 },
  note: { fontSize: 13, marginTop: 8 },
});
