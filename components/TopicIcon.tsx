import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { topicStatus, type TopicStats, type TopicStatus } from '../db';
import { useTheme } from '../hooks/useTheme';
import { tint } from './List';

export const TOPIC_STATUS_LABELS: Record<TopicStatus, string> = { done: 'Done', working: 'Working', blocked: 'Blocked' };
const LABELS = TOPIC_STATUS_LABELS;

/** Colour for a topic's status (grey when it has no entries yet). */
export function useTopicStatusColor(stats: TopicStats | undefined): string {
  const t = useTheme();
  const status = stats ? topicStatus(stats) : null;
  return status ? t.types[status === 'working' ? 'in_progress' : status] : t.muted;
}

/**
 * The topic's tag icon, coloured by how its work is going: green Done,
 * blue Working, red Blocked, grey when it has no entries yet.
 */
export function TopicIcon({ stats, size = 36 }: { stats: TopicStats; size?: number }) {
  const t = useTheme();
  const status = topicStatus(stats);
  const color = useTopicStatusColor(stats);
  return (
    <View
      style={{ width: size, height: size, borderRadius: size * 0.28, alignItems: 'center', justifyContent: 'center', backgroundColor: tint(color, t.dark ? 0.22 : 0.14) }}
      accessible
      accessibilityLabel={`Status: ${status ? LABELS[status] : 'No entries yet'}`}
    >
      <Ionicons name={status ? 'pricetag' : 'pricetag-outline'} size={Math.round(size * 0.55)} color={color} />
    </View>
  );
}
