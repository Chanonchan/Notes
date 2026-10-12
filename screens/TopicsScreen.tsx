import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '../components/ui';
import { listTopicStats, type TopicStats } from '../db';
import { useQuery } from '../hooks/useDb';
import { useTheme } from '../hooks/useTheme';
import { formatDuration, formatRelativeDay } from '../services/dates';
import type { TabScreenProps } from '../types/navigation';

export function TopicsScreen({ navigation }: TabScreenProps<'Topics'>) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [showArchived, setShowArchived] = useState(false);
  const { data } = useQuery((db) => listTopicStats(db, { includeArchived: showArchived }), [showArchived]);
  const stats = data ?? [];

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: t.text }]}>Topics</Text>
        <Chip label="Show archived" selected={showArchived} onPress={() => setShowArchived((v) => !v)} />
      </View>

      {data && !stats.length ? (
        <Text style={[styles.empty, { color: t.muted }]}>
          No topics yet. Create one with “+ New” when you log an entry.
        </Text>
      ) : null}

      <View style={styles.list}>
        {stats.map((s) => (
          <TopicCard key={s.topic.id} stats={s} onPress={() => navigation.navigate('TopicDetail', { topicId: s.topic.id })} />
        ))}
      </View>
    </ScrollView>
  );
}

function TopicCard({ stats: s, onPress }: { stats: TopicStats; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: pressed ? t.chip : t.card, borderColor: t.border, opacity: s.topic.archived ? 0.6 : 1 },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.dot, { backgroundColor: s.topic.color }]} />
        <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
          {s.topic.name}
        </Text>
        {s.topic.archived ? <Text style={{ color: t.muted, fontSize: 12 }}>ARCHIVED</Text> : null}
        <Text style={[styles.chevron, { color: t.muted }]}>›</Text>
      </View>
      <View style={styles.statsRow}>
        <Stat label={s.entryCount === 1 ? 'entry' : 'entries'} value={String(s.entryCount)} />
        <Stat label="time" value={s.totalMinutes ? formatDuration(s.totalMinutes) : '—'} />
        <Stat label={s.daysActive === 1 ? 'day' : 'days'} value={String(s.daysActive)} />
      </View>
      <Text style={{ color: t.muted, fontSize: 13 }}>
        {s.lastDay ? `Last activity: ${formatRelativeDay(s.lastDay)}` : 'No entries yet'}
      </Text>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: t.text }]}>{value}</Text>
      <Text style={{ color: t.muted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '800' },
  empty: { fontSize: 15, textAlign: 'center', paddingVertical: 32 },
  list: { gap: 12 },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  name: { fontSize: 18, fontWeight: '700', flexShrink: 1 },
  chevron: { fontSize: 26, marginLeft: 'auto', lineHeight: 26 },
  statsRow: { flexDirection: 'row', gap: 24 },
  stat: { alignItems: 'flex-start' },
  statValue: { fontSize: 18, fontWeight: '700' },
});
