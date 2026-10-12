import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GroupLabel, ListGroup, ListRow, ScreenHeader, tint } from '../components/List';
import { Chip } from '../components/ui';
import { listTopicStats, type TopicStats } from '../db';
import { useQuery } from '../hooks/useDb';
import { useTheme } from '../hooks/useTheme';
import { formatDuration, formatRelativeDay } from '../services/dates';
import type { TabScreenProps } from '../types/navigation';

export function topicSubtitle(s: TopicStats): string {
  const parts = [`${s.entryCount} ${s.entryCount === 1 ? 'entry' : 'entries'}`];
  if (s.totalMinutes) parts.push(formatDuration(s.totalMinutes));
  parts.push(s.lastDay ? `last ${formatRelativeDay(s.lastDay).toLowerCase()}` : 'not used yet');
  return parts.join(' · ');
}

export function TopicsScreen({ navigation }: TabScreenProps<'Topics'>) {
  const t = useTheme();
  const [showArchived, setShowArchived] = useState(false);
  const { data } = useQuery((db) => listTopicStats(db, { includeArchived: showArchived }), [showArchived]);
  const stats = data ?? [];
  const active = stats.filter((s) => !s.topic.archived);
  const archived = stats.filter((s) => s.topic.archived);

  const row = (s: TopicStats) => (
    <ListRow
      key={s.topic.id}
      icon="pricetag"
      iconColor={s.topic.color}
      iconBg={tint(s.topic.color, t.dark ? 0.22 : 0.14)}
      title={s.topic.name}
      titleLines={1}
      subtitle={topicSubtitle(s)}
      onPress={() => navigation.navigate('TopicDetail', { topicId: s.topic.id })}
    />
  );

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.container}>
      <ScreenHeader
        title="Topics"
        right={<Chip label="Show archived" selected={showArchived} onPress={() => setShowArchived((v) => !v)} />}
      />
      <View style={styles.body}>
        {data && !stats.length ? (
          <Text style={[styles.empty, { color: t.muted }]}>
            No topics yet. Create one from the Topic button on the Today screen.
          </Text>
        ) : null}
        {active.length ? (
          <>
            <GroupLabel right={`${active.length}`}>Active</GroupLabel>
            <ListGroup>{active.map(row)}</ListGroup>
          </>
        ) : null}
        {archived.length ? (
          <>
            <GroupLabel right={`${archived.length}`}>Archived</GroupLabel>
            <ListGroup style={{ opacity: 0.7 }}>{archived.map(row)}</ListGroup>
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 48 },
  body: { paddingHorizontal: 16 },
  empty: { fontSize: 15, textAlign: 'center', paddingVertical: 32 },
});
