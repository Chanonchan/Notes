import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { DayTimeline } from '../components/DayTimeline';
import { TYPE_ICONS } from '../components/EntryRow';
import { DurationChips } from '../components/DurationChips';
import { ListGroup, ListRow, ScreenHeader } from '../components/List';
import { TodoList } from '../components/TodoList';
import { TopicPicker } from '../components/TopicPicker';
import { TypeSelector } from '../components/TypeSelector';
import { createEntry, createTopicWithTags, listOpenItems, OPEN_TYPES, setLastTopicId, updateEntry } from '../db';
import { useDayEntries, useLastTopicId, useTopicSuggestion, useTopics } from '../hooks/useData';
import { useMutation, useQuery } from '../hooks/useDb';
import { useReminder } from '../hooks/useHabits';
import { storageStats } from '../services/export';
import { isInstalledApp } from '../services/export/files';
import { useTheme } from '../hooks/useTheme';
import { formatDayLong, formatDuration, formatRelativeDay, todayKey } from '../services/dates';
import { ENTRY_TYPE_LABELS, type Entry, type EntryType } from '../types';
import type { TabScreenProps } from '../types/navigation';

/**
 * Home screen. Today's log fills the screen; the composer is pinned to the
 * bottom (thumb reach), like a chat app. Type and time are tucked behind
 * "options" pills since most entries are just text + topic.
 */
export function CaptureScreen({ navigation, route }: TabScreenProps<'Log'>) {
  const t = useTheme();
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const { topics } = useTopics();
  const lastTopicId = useLastTopicId();
  const today = todayKey();
  const { entries } = useDayEntries(today);
  const doneToday = entries.filter((e) => !OPEN_TYPES.includes(e.type));
  const openCount = useQuery((db) => listOpenItems(db)).data?.length ?? 0;
  // Fresh home-screen install with an empty log: point to the Safari → app move.
  const totalEntries = useQuery((db) => storageStats(db), []).data?.entries;
  const showMoveHint = Platform.OS === 'web' && isInstalledApp() && totalEntries === 0;
  const reminder = useReminder(entries);

  const [text, setText] = useState('');
  const [topicId, setTopicId] = useState<number | null>(null);
  const [type, setType] = useState<EntryType>('done');
  const [duration, setDuration] = useState<number | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);
  // Last ticked-off item, so a mis-tap can be undone.
  const [undo, setUndo] = useState<{ id: number; type: EntryType; day: string; text: string; newType: EntryType } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoreType = useMutation((db, id: number, prev: EntryType, day: string) => updateEntry(db, id, { type: prev, day }));
  const offerUndo = (e: Entry, newType: EntryType = 'done') => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo({ id: e.id, type: e.type, day: e.day, text: e.text, newType });
    undoTimer.current = setTimeout(() => setUndo(null), 5000);
  };
  const topicTouched = useRef(false);
  const suggestedId = useTopicSuggestion(text);

  // Pre-select the last used topic once it has loaded.
  useEffect(() => {
    if (lastTopicId !== undefined && !topicTouched.current) setTopicId(lastTopicId);
  }, [lastTopicId]);

  // Opened from the reminder notification (or anywhere asking for focus).
  useEffect(() => {
    if (route.params?.focus) {
      const id = setTimeout(() => inputRef.current?.focus(), 300);
      navigation.setParams({ focus: undefined });
      return () => clearTimeout(id);
    }
  }, [route.params?.focus, navigation]);

  const add = useMutation(async (db) => {
    await createEntry(db, { topicId, text, type, durationMinutes: duration });
    await setLastTopicId(db, topicId);
  });
  const addTopic = useMutation((db, name: string, tags: string[]) => createTopicWithTags(db, name, tags));

  const canAdd = text.trim().length > 0 && !saving;
  const submit = async () => {
    if (!canAdd) return;
    setSaving(true);
    try {
      await add();
      setText('');
      setType('done');
      setDuration(null);
      setShowOptions(false);
      setToast(true);
      setTimeout(() => setToast(false), 1400);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    } finally {
      setSaving(false);
    }
  };

  const pickTopic = (id: number | null) => {
    topicTouched.current = true;
    setTopicId(id);
  };

  const totalMinutes = entries.reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
  const optionsLabel = `${ENTRY_TYPE_LABELS[type]}${duration ? ` · ${formatDuration(duration)}` : ''}`;
  const optionsChanged = type !== 'done' || duration != null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader
        title="Today"
        subtitle={[
          formatDayLong(today),
          entries.length ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}` : null,
          totalMinutes ? formatDuration(totalMinutes) : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        right={
          <View style={styles.headerRight}>
            <Pressable onPress={() => navigation.navigate('Search')} accessibilityRole="button" accessibilityLabel="Search" hitSlop={10} style={styles.iconBtn}>
              <Ionicons name="search" size={24} color={t.text} />
            </Pressable>
          </View>
        }
      />

      {reminder.show ? (
        <View style={styles.banner}>
          <ListGroup>
            <ListRow
              icon="notifications"
              title="Anything you forgot to log today?"
              subtitle="Tap to add it now"
              onPress={() => inputRef.current?.focus()}
              chevron={false}
              right={
                <Pressable onPress={() => reminder.dismiss()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Dismiss reminder">
                  <Ionicons name="close" size={22} color={t.muted} />
                </Pressable>
              }
            />
          </ListGroup>
        </View>
      ) : null}


      {/* Today's log */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <TodoList onEdit={(e) => navigation.navigate('EntryEdit', { entryId: e.id })} onChecked={offerUndo} />
        {doneToday.length ? (
          <>
            <Text style={[styles.sectionTitle, { color: t.text }]}>Today's log</Text>
            <DayTimeline
              day={today}
              excludeTypes={OPEN_TYPES}
              emptyText=""
              onEdit={(e) => navigation.navigate('EntryEdit', { entryId: e.id })}
              onChecked={(e) => offerUndo(e)}
            />
          </>
        ) : openCount ? (
          <Text style={[styles.hint, { color: t.muted }]}>Nothing done yet today. Log it in the box below.</Text>
        ) : !entries.length ? (
          <View style={styles.empty}>
            <Ionicons name="sunny-outline" size={44} color={t.muted} />
            <Text style={[styles.emptyTitle, { color: t.text }]}>Nothing logged yet today</Text>
            <Text style={[styles.emptyText, { color: t.muted }]}>
              Type what you did in the box below and tap the arrow.{'\n'}Tap an entry later to edit it.
            </Text>
            {showMoveHint ? (
              <Pressable onPress={() => navigation.navigate('Backup')} accessibilityRole="button" hitSlop={8} style={styles.moveHint}>
                <Ionicons name="swap-horizontal" size={18} color={t.primary} />
                <Text style={{ color: t.primary, fontSize: 15, fontWeight: '700' }}>Used DayLog in Safari? Bring your entries here</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* Composer */}
      <View style={[styles.composer, { backgroundColor: t.card, borderTopColor: t.border }]}>
        {undo ? (
          <View style={[styles.undoBar, { backgroundColor: t.text }]}>
            <Ionicons name={TYPE_ICONS[undo.newType]} size={20} color={t.types[undo.newType]} />
            <Text style={{ color: t.bg, fontSize: 15, flex: 1 }} numberOfLines={1}>
              {ENTRY_TYPE_LABELS[undo.newType]}: {undo.text}
            </Text>
            <Pressable
              onPress={async () => {
                const u = undo;
                setUndo(null);
                if (u) await restoreType(u.id, u.type, u.day);
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Undo"
            >
              <Text style={{ color: t.dark ? t.primary : '#8FB3FF', fontSize: 15, fontWeight: '800' }}>Undo</Text>
            </Pressable>
          </View>
        ) : null}
        {toast ? (
          <View style={[styles.toast, { backgroundColor: t.types.done }]} pointerEvents="none">
            <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
            <Text style={[styles.toastText, { color: '#FFFFFF' }]}>Logged</Text>
          </View>
        ) : null}

        <TopicPicker topics={topics} value={topicId} onChange={pickTopic} onCreate={addTopic} suggestedId={suggestedId} />

        {showOptions ? (
          <View style={styles.options}>
            <TypeSelector value={type} onChange={setType} />
            <DurationChips value={duration} onChange={setDuration} />
          </View>
        ) : null}

        <View style={styles.inputRow}>
          <Pressable
            onPress={() => setShowOptions((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={`Type and time: ${optionsLabel}. Tap to ${showOptions ? 'hide' : 'change'}.`}
            hitSlop={6}
            style={[styles.typeBtn, { backgroundColor: t.chip, borderWidth: showOptions ? 1.5 : 0, borderColor: t.primary }]}
          >
            <Ionicons name={TYPE_ICONS[type]} size={24} color={t.types[type]} />
            {duration ? (
              <View style={[styles.durBadge, { backgroundColor: t.text }]}>
                <Text style={[styles.durText, { color: t.bg }]}>{formatDuration(duration)}</Text>
              </View>
            ) : null}
          </Pressable>

          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            placeholder="What did you do?"
            placeholderTextColor={t.muted}
            multiline
            numberOfLines={1}
            submitBehavior="submit"
            returnKeyType="send"
            onSubmitEditing={submit}
            style={[styles.input, { color: t.text, backgroundColor: t.bg, borderColor: t.border }]}
            accessibilityLabel="Entry text"
          />

          <Pressable
            onPress={submit}
            disabled={!canAdd}
            accessibilityRole="button"
            accessibilityLabel="Add entry"
            hitSlop={6}
            style={({ pressed }) => [
              styles.send,
              { backgroundColor: canAdd ? t.primary : t.chip, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Ionicons name="arrow-up" size={26} color={canAdd ? t.onPrimary : t.muted} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  typeBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  durBadge: { position: 'absolute', bottom: -4, right: -6, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  durText: { fontSize: 11, fontWeight: '800' },
  banner: { paddingHorizontal: 16, paddingTop: 4 },
  list: { paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1 },
  sectionTitle: { fontSize: 20, fontWeight: '800', marginTop: 28, marginBottom: -8, paddingHorizontal: 4 },
  hint: { fontSize: 14, marginTop: 24, paddingHorizontal: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  undoBar: {
    position: 'absolute',
    top: -56,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    zIndex: 11,
  },
  moveHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, minHeight: 44 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, gap: 10 },
  options: { gap: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    fontSize: 17,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    lineHeight: 22,
    textAlignVertical: 'center',
  },
  send: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  toast: {
    position: 'absolute',
    top: -44,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    zIndex: 10,
  },
  toastText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
