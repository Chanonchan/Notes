import { Ionicons } from '@expo/vector-icons';
import { useLayoutEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ENTRY_INSET, EntryRow } from '../components/EntryRow';
import { GroupLabel, IconTile, ListGroup, ListRow } from '../components/List';
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

  const [menuOpen, setMenuOpen] = useState(false);
  useLayoutEffect(() => {
    navigation.setOptions({
      title: topic?.name ?? 'Topic',
      headerRight: () => (
        <Pressable onPress={() => setMenuOpen(true)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Topic actions" style={{ paddingHorizontal: 8 }}>
          <Ionicons name="ellipsis-horizontal" size={24} color={t.primary} />
        </Pressable>
      ),
    });
  }, [navigation, topic?.name, t.primary]);

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
  const topicTile = (_color?: string) => <IconTile icon="pricetag-outline" color={t.muted} />;

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
      {renaming ? (
        <ListGroup>
          <View style={styles.renameRow}>
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
        </ListGroup>
      ) : null}
      <View style={styles.statsRow}>
        <Text style={{ color: t.muted, fontSize: 15, flex: 1 }}>
          {topicSubtitle(stats)}
          {topic.archived ? ' · archived' : ''}
        </Text>
      </View>

      {!entries.length ? <Text style={[styles.empty, { color: t.muted }]}>No entries in this topic yet.</Text> : null}
      {[...byDay].map(([day, list]) => (
        <View key={day}>
          <GroupLabel>
            {formatRelativeDay(day)}
            {formatRelativeDay(day) !== formatDayLong(day) ? ` · ${formatDayLong(day)}` : ''}
          </GroupLabel>
          <ListGroup inset={ENTRY_INSET}>
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

      <Modal visible={menuOpen} transparent animationType="slide" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: t.bg }]}>
          <Text style={[styles.sheetTitle, { color: t.text, marginBottom: 12 }]}>{topic.name}</Text>
          <ListGroup>
            <ListRow
              icon="pencil"
              title="Rename"
              chevron={false}
              onPress={() => {
                setMenuOpen(false);
                setName(topic.name);
                setRenaming(true);
              }}
            />
            <ListRow
              icon="git-merge"
              title="Merge into another topic"
              chevron={false}
              onPress={() => {
                setMenuOpen(false);
                setMerging(true);
              }}
            />
            <ListRow
              icon={topic.archived ? 'arrow-undo' : 'archive'}
              title={topic.archived ? 'Unarchive' : 'Archive'}
              subtitle={topic.archived ? undefined : 'Hides it from the topic list; entries are kept'}
              chevron={false}
              onPress={() => {
                setMenuOpen(false);
                archive(!topic.archived);
              }}
            />
          </ListGroup>
          <Button label="Cancel" kind="secondary" onPress={() => setMenuOpen(false)} style={{ marginTop: 12 }} />
        </View>
      </Modal>

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
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, marginTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  nameInput: { flex: 1, fontSize: 17, borderWidth: 2, borderRadius: 10, paddingHorizontal: 10, minHeight: 44 },
  note: { fontSize: 13, marginTop: 8, paddingHorizontal: 4 },
  empty: { textAlign: 'center', paddingVertical: 32, fontSize: 15 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 32 },
  sheetTitle: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
});
