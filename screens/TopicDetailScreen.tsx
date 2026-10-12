import { useLayoutEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { EntryRow } from '../components/EntryRow';
import { Button, Card, Chip, SectionTitle } from '../components/ui';
import { listEntriesByTopic, listTopicStats, mergeTopics, renameTopic, setTopicArchived } from '../db';
import { useQuery, useMutation } from '../hooks/useDb';
import { useEntryActions } from '../hooks/useEntryActions';
import { TAP, useTheme } from '../hooks/useTheme';
import { formatDayLong, formatDuration, formatRelativeDay } from '../services/dates';
import { confirmDestructive, showError } from '../services/dialogs';
import type { Entry } from '../types';
import type { RootScreenProps } from '../types/navigation';

export function TopicDetailScreen({ navigation, route }: RootScreenProps<'TopicDetail'>) {
  const t = useTheme();
  const { topicId } = route.params;
  const actions = useEntryActions();
  const { data: all } = useQuery((db) => listTopicStats(db, { includeArchived: true }));
  const { data: entries } = useQuery((db) => listEntriesByTopic(db, topicId), [topicId]);
  const stats = all?.find((s) => s.topic.id === topicId);
  const topic = stats?.topic;

  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [merging, setMerging] = useState(false);

  const rename = useMutation((db, n: string) => renameTopic(db, topicId, n));
  const archive = useMutation((db, v: boolean) => setTopicArchived(db, topicId, v));
  const merge = useMutation((db, targetId: number) => mergeTopics(db, topicId, targetId));

  useLayoutEffect(() => {
    navigation.setOptions({ title: topic?.name ?? 'Topic' });
  }, [navigation, topic?.name]);

  if (!all || !entries) return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  if (!topic || !stats) {
    return (
      <View style={[styles.gone, { backgroundColor: t.bg }]}>
        <Text style={{ color: t.muted }}>This topic no longer exists.</Text>
      </View>
    );
  }

  const byDay = new Map<string, Entry[]>();
  for (const e of entries) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);
  const others = all.filter((s) => s.topic.id !== topicId);

  const saveName = async () => {
    try {
      await rename(name);
      setRenaming(false);
    } catch (e) {
      showError('Could not rename', e);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Card style={styles.summary}>
        <View style={styles.nameRow}>
          <View style={[styles.dot, { backgroundColor: topic.color }]} />
          {renaming ? (
            <TextInput
              autoFocus
              value={name}
              onChangeText={setName}
              onSubmitEditing={saveName}
              returnKeyType="done"
              style={[styles.nameInput, { color: t.text, borderColor: t.primary }]}
              accessibilityLabel="Topic name"
            />
          ) : (
            <Text style={[styles.name, { color: t.text }]}>{topic.name}</Text>
          )}
        </View>
        <Text style={{ color: t.muted, fontSize: 15 }}>
          {stats.entryCount} {stats.entryCount === 1 ? 'entry' : 'entries'} · {stats.daysActive}{' '}
          {stats.daysActive === 1 ? 'day' : 'days'}
          {stats.totalMinutes ? ` · ${formatDuration(stats.totalMinutes)}` : ''}
          {stats.lastDay ? ` · last ${formatRelativeDay(stats.lastDay).toLowerCase()}` : ''}
        </Text>
        <View style={styles.actions}>
          {renaming ? (
            <>
              <Chip label="Save name" selected onPress={saveName} />
              <Chip label="Cancel" onPress={() => setRenaming(false)} />
            </>
          ) : (
            <>
              <Chip
                label="Rename"
                onPress={() => {
                  setName(topic.name);
                  setRenaming(true);
                }}
              />
              <Chip label="Merge into…" onPress={() => setMerging(true)} />
              <Chip label={topic.archived ? 'Unarchive' : 'Archive'} onPress={() => archive(!topic.archived)} />
            </>
          )}
        </View>
        {topic.archived ? (
          <Text style={{ color: t.muted, fontSize: 13 }}>
            Archived: hidden from the topic picker and “untouched topics” in summaries.
          </Text>
        ) : null}
      </Card>

      {!entries.length ? <Text style={[styles.empty, { color: t.muted }]}>No entries in this topic yet.</Text> : null}
      {[...byDay].map(([day, list]) => (
        <View key={day}>
          <SectionTitle>
            {formatRelativeDay(day)}
            {formatRelativeDay(day) !== formatDayLong(day) ? ` · ${formatDayLong(day)}` : ''}
          </SectionTitle>
          <Card style={styles.dayCard}>
            {list.map((e) => (
              <EntryRow
                key={e.id}
                entry={e}
                onPress={() => navigation.navigate('EntryEdit', { entryId: e.id })}
                onTypePress={() => actions.open(e)}
              />
            ))}
          </Card>
        </View>
      ))}
      {actions.menu}

      <Modal visible={merging} transparent animationType="fade" onRequestClose={() => setMerging(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMerging(false)}>
          <View style={[styles.sheet, { backgroundColor: t.card }]}>
            <Text style={[styles.sheetTitle, { color: t.text }]}>Merge “{topic.name}” into…</Text>
            <Text style={{ color: t.muted, marginBottom: 8 }}>
              All its entries move to the topic you pick, then “{topic.name}” is deleted.
            </Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {others.length ? (
                others.map((o) => (
                  <Pressable
                    key={o.topic.id}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.option, { backgroundColor: pressed ? t.chip : 'transparent' }]}
                    onPress={() => {
                      setMerging(false);
                      confirmDestructive(
                        'Merge topics?',
                        `Move ${stats.entryCount} entries from “${topic.name}” into “${o.topic.name}” and delete “${topic.name}”.`,
                        'Merge',
                        async () => {
                          try {
                            await merge(o.topic.id);
                            navigation.replace('TopicDetail', { topicId: o.topic.id });
                          } catch (e) {
                            showError('Could not merge', e);
                          }
                        },
                      );
                    }}
                  >
                    <View style={[styles.dot, { backgroundColor: o.topic.color }]} />
                    <Text style={{ color: t.text, fontSize: 17 }}>{o.topic.name}</Text>
                    <Text style={{ color: t.muted, marginLeft: 'auto' }}>{o.entryCount}</Text>
                  </Pressable>
                ))
              ) : (
                <Text style={{ color: t.muted, paddingVertical: 12 }}>There are no other topics to merge into.</Text>
              )}
            </ScrollView>
            <Button label="Cancel" kind="secondary" onPress={() => setMerging(false)} style={{ marginTop: 8 }} />
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  gone: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  summary: { gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  name: { fontSize: 22, fontWeight: '800', flexShrink: 1 },
  nameInput: { flex: 1, fontSize: 20, borderWidth: 2, borderRadius: 10, paddingHorizontal: 10, minHeight: 44 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  empty: { textAlign: 'center', paddingVertical: 32, fontSize: 15 },
  dayCard: { paddingHorizontal: 8, paddingVertical: 6 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 32 },
  sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  option: { minHeight: TAP + 4, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, borderRadius: 10 },
});
