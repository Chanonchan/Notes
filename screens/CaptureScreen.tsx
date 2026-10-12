import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DayTimeline } from '../components/DayTimeline';
import { DurationChips } from '../components/DurationChips';
import { TopicPicker } from '../components/TopicPicker';
import { TypeSelector } from '../components/TypeSelector';
import { createEntry, createTopic, getCarryOver, isCarryOverDismissed, setLastTopicId } from '../db';
import { useDayEntries, useLastTopicId, useTopicSuggestion, useTopics } from '../hooks/useData';
import { useMutation, useQuery } from '../hooks/useDb';
import { useTheme } from '../hooks/useTheme';
import { formatDayLong, formatDuration, formatRelativeDay, todayKey } from '../services/dates';
import { ENTRY_TYPE_LABELS, type EntryType } from '../types';
import type { TabScreenProps } from '../types/navigation';

/**
 * Home screen. Today's log fills the screen; the composer is pinned to the
 * bottom (thumb reach), like a chat app. Type and time are tucked behind
 * "options" pills since most entries are just text + topic.
 */
export function CaptureScreen({ navigation, route }: TabScreenProps<'Log'>) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const { topics } = useTopics();
  const lastTopicId = useLastTopicId();
  const today = todayKey();
  const { entries } = useDayEntries(today);
  const carry = useQuery((db) => getCarryOver(db, today), [today]).data;
  const carryDismissed = useQuery((db) => isCarryOverDismissed(db, today), [today]).data;

  const [text, setText] = useState('');
  const [topicId, setTopicId] = useState<number | null>(null);
  const [type, setType] = useState<EntryType>('done');
  const [duration, setDuration] = useState<number | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);
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
  const addTopic = useMutation((db, name: string) => createTopic(db, name));

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
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: t.border }]}>
        <View>
          <Text style={[styles.title, { color: t.text }]}>Today</Text>
          <Text style={[styles.date, { color: t.muted }]}>{formatDayLong(today)}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.stats}>
            <Text style={[styles.statBig, { color: t.text }]}>{entries.length}</Text>
            <Text style={[styles.statSmall, { color: t.muted }]}>
              {entries.length === 1 ? 'entry' : 'entries'}
              {totalMinutes ? ` · ${formatDuration(totalMinutes)}` : ''}
            </Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('Search')}
            accessibilityRole="button"
            accessibilityLabel="Search"
            hitSlop={8}
            style={[styles.iconBtn, { backgroundColor: t.chip }]}
          >
            <Ionicons name="search" size={22} color={t.text} />
          </Pressable>
        </View>
      </View>

      {carry && !carryDismissed ? (
        <Pressable
          onPress={() => navigation.navigate('CarryOver')}
          accessibilityRole="button"
          style={[styles.banner, { backgroundColor: t.card, borderColor: t.types.in_progress }]}
        >
          <Ionicons name="return-down-forward" size={20} color={t.types.in_progress} />
          <Text style={{ color: t.text, fontSize: 15, flex: 1 }}>
            <Text style={{ fontWeight: '700' }}>
              {carry.items.length} open {carry.items.length === 1 ? 'item' : 'items'}
            </Text>{' '}
            from {formatRelativeDay(carry.fromDay, today).toLowerCase() === 'yesterday' ? 'yesterday' : formatRelativeDay(carry.fromDay, today)}
          </Text>
          <Text style={{ color: t.primary, fontWeight: '700' }}>Review</Text>
        </Pressable>
      ) : null}

      {/* Today's log */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {entries.length ? (
          <DayTimeline day={today} onEdit={(e) => navigation.navigate('EntryEdit', { entryId: e.id })} />
        ) : (
          <View style={styles.empty}>
            <Ionicons name="sunny-outline" size={44} color={t.muted} />
            <Text style={[styles.emptyTitle, { color: t.text }]}>Nothing logged yet today</Text>
            <Text style={[styles.emptyText, { color: t.muted }]}>
              Type what you did in the box below and tap the arrow.{'\n'}Tap an entry later to edit it.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Composer */}
      <View style={[styles.composer, { backgroundColor: t.card, borderTopColor: t.border }]}>
        {toast ? (
          <View style={[styles.toast, { backgroundColor: t.types.done }]} pointerEvents="none">
            <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
            <Text style={styles.toastText}>Logged</Text>
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
            style={[
              styles.optionsPill,
              { backgroundColor: optionsChanged ? t.types[type] : t.chip },
            ]}
          >
            <View style={styles.optionsLabels}>
              <Text style={[styles.optionsText, { color: optionsChanged ? '#FFFFFF' : t.text }]} numberOfLines={1}>
                {ENTRY_TYPE_LABELS[type]}
              </Text>
              {duration ? (
                <Text style={[styles.optionsSub, { color: '#FFFFFF' }]} numberOfLines={1}>
                  {formatDuration(duration)}
                </Text>
              ) : null}
            </View>
            <Ionicons name={showOptions ? 'chevron-down' : 'chevron-up'} size={14} color={optionsChanged ? '#FFFFFF' : t.muted} />
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
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 30, fontWeight: '800' },
  date: { fontSize: 15, marginTop: 2 },
  stats: { alignItems: 'flex-end' },
  statBig: { fontSize: 26, fontWeight: '800' },
  statSmall: { fontSize: 13 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  list: { padding: 16, paddingBottom: 24, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, gap: 10 },
  options: { gap: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  optionsPill: {
    height: 48,
    maxWidth: 150,
    borderRadius: 24,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  optionsLabels: { flexShrink: 1 },
  optionsText: { fontSize: 13, fontWeight: '700' },
  optionsSub: { fontSize: 12, fontWeight: '600', opacity: 0.9 },
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
