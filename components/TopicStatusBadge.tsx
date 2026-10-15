import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { topicStatus, type TopicStats, type TopicStatus } from '../db';
import { useTheme } from '../hooks/useTheme';
import { tint } from './List';

const LABELS: Record<TopicStatus, string> = { done: 'Done', working: 'Working', blocked: 'Blocked' };

/** "Done" / "Working" / "Blocked" pill for a topic, from the state of its work. */
export function TopicStatusBadge({ stats, style }: { stats: TopicStats; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const status = topicStatus(stats);
  if (!status) return null;
  const color = t.types[status === 'working' ? 'in_progress' : status];
  return (
    <View style={[styles.pill, { backgroundColor: tint(color, 0.14) }, style]} accessibilityLabel={`Status: ${LABELS[status]}`}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 26, borderRadius: 13 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  label: { fontSize: 13, fontWeight: '700' },
});
