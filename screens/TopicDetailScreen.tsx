import { Ionicons } from '@expo/vector-icons';
import { useLayoutEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { EntryRow } from '../components/EntryRow';
import { GroupLabel, IconTile, ListGroup, ListRow, tint } from '../components/List';
import { Button, Chip } from '../components/ui';
import { listEntriesByTopic, listTopicStats, mergeTopics, renameTopic, setTopicArchived } from '../db';
import { useMutation, useQuery } from '../hooks/useDb';
import { useEntryActions } from '../hooks/useEntryActions';
import { useTheme } from '../hooks/useTheme';
import { formatDayLong, formatRelativeDay } from '../services/dates';
import { confirmDestructive, showError } from '../services/dialogs';
import type { Entry } from '../types';
import type { RootScreenProps } from '../types/navigation';
import { topicSubtitle } from './TopicsScreen';

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
  const topicTile = (color: string) => <IconTile icon="pricetag" color={color} bg={tint(color, t.dark ? 0.22 : 0.14)} />;

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
      <ListGroup>
        {renaming ? (
          <View style={styles.renameRow}>
            {topicTile(topic.color)}
            <TextInput
              autoFocus
              value={name}
              onChangeText={setName}
              onSubmitEditing={saveName}
              returnKeyType="done"
              style={[styles.nameInput, { color: t.text, borderColor: t.primary }]}
              accessibilityLabel="Topic name"
            />
            <Chip label="Save name" selected onPress={saveName} />
            <Pressable onPress={() => setRenaming(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cancel">
              <Ionicons name="close" size={22} color={t.muted} />
            </Pressable>
          </View>
        ) : (
          <ListRow leading={topicTile(topic.color)} title={topic.name} subtitle={topicSubtitle(stats)} />
        )}
        <ListRow
          icon="pencil"
          title="Rename"
          onPress={() => {
            setName(topic.name);
            setRenaming(true);
          }}
        />
        <ListRow icon="git-merge" title="Merge into another topic" subtitle="Move all entries, then delete this topic" onPress={() => setMerging(true)} />
        <ListRow
          icon={topic.archived ? 'arrow-undo' : 'archive'}
          title={topic.archived ? 'Unarchive' : 'Archive'}
          subtitle={topic.archived ? 'Show it in the topic list again' : 'Hide from the topic list; entries are kept'}
          onPress={() => archive(!topic.archived)}
          chevron={false}
        />
      </ListGroup>
      {topic.archived ? (
        <Text style={[styles.note, { color: t.muted }]}>
          Archived: hidden from the topic picker and “Not touched” in summaries.
        </Text>
      ) : null}

      {!entries.length ? <Text style={[styles.empty, { color: t.muted }]}>No entries in this topic yet.</Text> : null}
      {[...byDay].map(([day, list]) => (
        <View key={day}>
          <GroupLabel right={`${list.length}`}>
            {formatRelativeDay(day)}
            {formatRelativeDay(day) !== formatDayLong(day) ? ` · ${formatDayLong(day)}` : ''}
          </GroupLabel>
          <ListGroup>
            {list.map((e) => (
              <EntryRow
                key={e.id}
                entry={e}
                onPress={() => navigation.navigate('EntryEdit', { entryId: e.id })}
                onTypePress={() => actions.open(e)}
              />
            ))}
          </ListGroup>
        </View>
      ))}
      {actions.menu}

      <Modal visible={merging} transparent animationType="slide" onRequestClose={() => setMerging(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMerging(false)} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: t.bg }]}>
          <Text style={[styles.sheetTitle, { color: t.text }]}>Merge “{topic.name}” into…</Text>
          <Text style={{ color: t.muted, marginBottom: 12 }}>
            All its entries move to the topic you pick, then “{topic.name}” is deleted.
          </Text>
          <ScrollView style={{ maxHeight: 380 }}>
            {others.length ? (
              <ListGroup>
                {others.map((o) => (
                  <ListRow
                    key={o.topic.id}
                    leading={topicTile(o.topic.color)}
                    title={o.topic.name}
                    titleLines={1}
                    subtitle={topicSubtitle(o)}
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
                  />
                ))}
              </ListGroup>
            ) : (
              <Text style={{ color: t.muted, paddingVertical: 12 }}>There are no other topics to merge into.</Text>
            )}
          </ScrollView>
          <Button label="Cancel" kind="secondary" onPress={() => setMerging(false)} style={{ marginTop: 12 }} />
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  gone: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  renameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, minHeight: 60 },
  nameInput: { flex: 1, fontSize: 17, borderWidth: 2, borderRadius: 10, paddingHorizontal: 10, minHeight: 44 },
  note: { fontSize: 13, marginTop: 8, paddingHorizontal: 4 },
  empty: { textAlign: 'center', paddingVertical: 32, fontSize: 15 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 32 },
  sheetTitle: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
});
