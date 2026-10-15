import { Ionicons } from '@expo/vector-icons';
import { useLayoutEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Composer, UndoBar } from '../components/Composer';
import { ENTRY_INSET, EntryRow } from '../components/EntryRow';
import { GroupLabel, IconTile, ListGroup, ListRow } from '../components/List';
import { TopicStatusBadge } from '../components/TopicStatusBadge';
import { TodoList } from '../components/TodoList';
import { TagChips, TagEditor, withDraft } from '../components/TopicTags';
import { Button, Chip } from '../components/ui';
import { listEntriesByTopic, listTopicStats, OPEN_TYPES, mergeTopics, renameTopic, setTopicArchived, setTopicTags } from '../db';
import { useMutation, useQuery } from '../hooks/useDb';
import { useEntryActions } from '../hooks/useEntryActions';
import { useTheme } from '../hooks/useTheme';
import { useUndo } from '../hooks/useUndo';
import { formatDayLong, formatRelativeDay } from '../services/dates';
import { confirmDestructive, showError } from '../services/dialogs';
import type { Entry } from '../types';
import type { RootScreenProps } from '../types/navigation';
import { topicSubtitle } from './TopicsScreen';

export function TopicDetailScreen({ navigation, route }: RootScreenProps<'TopicDetail'>) {
  const t = useTheme();
  const { topicId } = route.params;
  const actions = useEntryActions();
  const { undo, offer: offerUndo, run: runUndo } = useUndo();
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const [composing, setComposing] = useState(false);
  const { data: all } = useQuery((db) => listTopicStats(db, { includeArchived: true }));
  const { data: entries } = useQuery((db) => listEntriesByTopic(db, topicId), [topicId]);
  const stats = all?.find((s) => s.topic.id === topicId);
  const topic = stats?.topic;

  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [merging, setMerging] = useState(false);
  const [editingTags, setEditingTags] = useState<string[] | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const saveTags = useMutation((db, tags: string[]) => setTopicTags(db, topicId, tags));

  const rename = useMutation((db, n: string) => renameTopic(db, topicId, n));
  const archive = useMutation((db, v: boolean) => setTopicArchived(db, topicId, v));
  const merge = useMutation((db, targetId: number) => mergeTopics(db, topicId, targetId));

  const [menuOpen, setMenuOpen] = useState(false);
  useLayoutEffect(() => {
    navigation.setOptions({
      // The full name is a wrapping heading in the page; the bar title would cut it off.
      title: '',
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
  // Open jobs are in the to-do list above; the log shows the rest by day.
  for (const e of entries) if (!OPEN_TYPES.includes(e.type)) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);
  const others = all.filter((s) => s.topic.id !== topicId);
  const topicTile = (_color?: string) => <IconTile icon="pricetag-outline" color={t.primary} />;

  const saveName = async () => {
    try {
      await rename(name);
      setRenaming(false);
    } catch (e) {
      showError('Could not rename', e);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
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
        {!renaming ? (
          <Text style={[styles.heading, { color: t.text }]} accessibilityRole="header">
            {topic.name}
          </Text>
        ) : null}
        <View style={styles.statsRow}>
          <Text style={{ color: t.muted, fontSize: 15, flex: 1 }}>
            {topicSubtitle(stats)}
            {topic.archived ? ' · archived' : ''}
          </Text>
          <TopicStatusBadge stats={stats} />
        </View>

        {editingTags ? (
          <View style={styles.tagsEdit}>
            <TagEditor tags={editingTags} onChange={setEditingTags} draft={tagDraft} onDraftChange={setTagDraft} autoFocus />
            <View style={styles.tagsActions}>
              <Button
                label="Cancel"
                kind="secondary"
                onPress={() => {
                  setEditingTags(null);
                  setTagDraft('');
                }}
                style={{ flex: 1 }}
              />
              <Button
                label="Save tags"
                onPress={async () => {
                  await saveTags(withDraft(editingTags, tagDraft));
                  setEditingTags(null);
                  setTagDraft('');
                }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => setEditingTags(stats.tags)}
            accessibilityRole="button"
            accessibilityLabel={stats.tags.length ? `Tags: ${stats.tags.join(', ')}. Tap to edit.` : 'Add tags'}
            style={styles.tagsRow}
          >
            <TagChips tags={stats.tags} />
            <Text style={{ color: t.primary, fontSize: 14, fontWeight: '700' }}>{stats.tags.length ? 'Edit tags' : '+ Add tags'}</Text>
          </Pressable>
        )}

        <TodoList topicId={topicId} onEdit={(e) => navigation.navigate('EntryEdit', { entryId: e.id })} onChecked={offerUndo} />

        {entries.some((e) => e.type === 'blocked') ? (
          <View>
            <GroupLabel right={`${entries.filter((e) => e.type === 'blocked').length}`}>Blocked</GroupLabel>
            <ListGroup inset={ENTRY_INSET}>
              {entries
                .filter((e) => e.type === 'blocked')
                .map((e) => (
                  <EntryRow
                    key={e.id}
                    entry={e}
                    showTime={false}
                    showType={false}
                    subtitle={formatRelativeDay(e.day)}
                    onPress={() => navigation.navigate('EntryEdit', { entryId: e.id })}
                    onTypePress={() => actions.open(e)}
                  />
                ))}
            </ListGroup>
          </View>
        ) : null}

        {!entries.length ? <Text style={[styles.empty, { color: t.muted }]}>Nothing here yet. Log work for this topic in the box below.</Text> : null}
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
      </ScrollView>

      {undo ? <UndoBar undo={undo} onUndo={runUndo} style={[styles.floatingUndo, { bottom: insets.bottom + 92 }]} /> : null}

      {/* Quick log: hidden until the + button is tapped. */}
      <Pressable
        onPress={() => setComposing(true)}
        accessibilityRole="button"
        accessibilityLabel={`Log work on ${topic.name}`}
        style={({ pressed }) => [styles.fab, { backgroundColor: t.primary, bottom: insets.bottom + 20, opacity: pressed ? 0.85 : 1 }]}
      >
        <Ionicons name="add" size={32} color={t.onPrimary} />
      </Pressable>
      <Modal visible={composing} transparent animationType="slide" onRequestClose={() => setComposing(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdrop} onPress={() => setComposing(false)} accessibilityLabel="Close" />
          <View style={[styles.composeSheet, { backgroundColor: t.card, paddingBottom: insets.bottom }]}>
            <View style={styles.composeHead}>
              <Text style={[styles.composeTitle, { color: t.text }]} numberOfLines={1}>
                Log work on {topic.name}
              </Text>
              <Pressable onPress={() => setComposing(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={t.muted} />
              </Pressable>
            </View>
            <Composer
              fixedTopicId={topicId}
              placeholder="What did you do?"
              autoFocus
              style={{ borderTopWidth: 0 }}
              onAdded={() => {
                setComposing(false);
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
              icon="pricetags-outline"
              title="Edit tags"
              chevron={false}
              onPress={() => {
                setMenuOpen(false);
                setEditingTags(stats.tags);
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 110 },
  fab: {
    position: 'absolute',
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  floatingUndo: { position: 'absolute', left: 16, right: 16 },
  composeSheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden' },
  composeHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 14 },
  composeTitle: { flex: 1, fontSize: 18, fontWeight: '800' },
  gone: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  renameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, minHeight: 60 },
  heading: { fontSize: 28, fontWeight: '800', lineHeight: 34, paddingHorizontal: 4 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 4, marginTop: 10 },
  tagsEdit: { marginTop: 12, gap: 10 },
  tagsActions: { flexDirection: 'row', gap: 10 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, marginTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  nameInput: { flex: 1, fontSize: 17, borderWidth: 2, borderRadius: 10, paddingHorizontal: 10, minHeight: 44 },
  note: { fontSize: 13, marginTop: 8, paddingHorizontal: 4 },
  empty: { textAlign: 'center', paddingVertical: 32, fontSize: 15 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 32 },
  sheetTitle: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
});
