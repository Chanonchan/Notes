import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { createEntry, createTopicWithTags, setLastTopicId } from '../db';
import { useLastTopicId, useTopicSuggestion, useTopics } from '../hooks/useData';
import { useMutation } from '../hooks/useDb';
import { useTheme } from '../hooks/useTheme';
import type { UndoInfo } from '../hooks/useUndo';
import { formatDuration } from '../services/dates';
import { ENTRY_TYPE_LABELS, type EntryType } from '../types';
import { DurationChips } from './DurationChips';
import { TYPE_ICONS } from './EntryRow';
import { TopicPicker } from './TopicPicker';
import { TypeSelector } from './TypeSelector';

/**
 * The quick-log box pinned to the bottom of a screen: type button, text,
 * send. With `fixedTopicId` every entry goes to that topic (no picker);
 * otherwise it shows the topic picker and remembers the last topic used.
 */
export function Composer({
  fixedTopicId,
  inputRef: externalRef,
  onAdded,
  undo,
  onUndo,
  placeholder = 'What did you do?',
  autoFocus,
  style,
}: {
  fixedTopicId?: number;
  inputRef?: RefObject<TextInput | null>;
  onAdded?: () => void;
  undo?: UndoInfo | null;
  onUndo?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const ownRef = useRef<TextInput>(null);
  const inputRef = externalRef ?? ownRef;
  const pickTopicMode = fixedTopicId === undefined;
  const { topics } = useTopics();
  const lastTopicId = useLastTopicId();

  const [text, setText] = useState('');
  const [topicId, setTopicId] = useState<number | null>(fixedTopicId ?? null);
  const [type, setType] = useState<EntryType>('done');
  const [duration, setDuration] = useState<number | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);
  const topicTouched = useRef(false);
  const suggestedId = useTopicSuggestion(pickTopicMode ? text : '');

  // Pre-select the last used topic once it has loaded.
  useEffect(() => {
    if (pickTopicMode && lastTopicId !== undefined && !topicTouched.current) setTopicId(lastTopicId);
  }, [lastTopicId, pickTopicMode]);
  useEffect(() => {
    if (!pickTopicMode) setTopicId(fixedTopicId);
  }, [fixedTopicId, pickTopicMode]);

  const add = useMutation(async (db) => {
    await createEntry(db, { topicId, text, type, durationMinutes: duration });
    if (pickTopicMode) await setLastTopicId(db, topicId);
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
      onAdded?.();
    } finally {
      setSaving(false);
    }
  };

  const optionsLabel = `${ENTRY_TYPE_LABELS[type]}${duration ? ` · ${formatDuration(duration)}` : ''}`;

  return (
    <View style={[styles.composer, { backgroundColor: t.card, borderTopColor: t.border }, style]}>
      {undo ? <UndoBar undo={undo} onUndo={onUndo} style={styles.undoAbove} /> : null}
      {toast ? (
        <View style={[styles.toast, { backgroundColor: t.types.done }]} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
          <Text style={styles.toastText}>Logged</Text>
        </View>
      ) : null}

      {pickTopicMode ? (
        <TopicPicker
          topics={topics}
          value={topicId}
          onChange={(id) => {
            topicTouched.current = true;
            setTopicId(id);
          }}
          onCreate={addTopic}
          suggestedId={suggestedId}
        />
      ) : null}

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
          autoFocus={autoFocus}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
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
          style={({ pressed }) => [styles.send, { backgroundColor: canAdd ? t.primary : t.chip, opacity: pressed ? 0.8 : 1 }]}
        >
          <Ionicons name="arrow-up" size={26} color={canAdd ? t.onPrimary : t.muted} />
        </Pressable>
      </View>
    </View>
  );
}

/** "Done: …  Undo" bar shown for a few seconds after a job is ticked off. */
export function UndoBar({ undo, onUndo, style }: { undo: UndoInfo; onUndo?: () => void; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[styles.undoBar, { backgroundColor: t.text }, style]}>
      <Ionicons name={TYPE_ICONS[undo.newType]} size={20} color={t.types[undo.newType]} />
      <Text style={{ color: t.bg, fontSize: 15, flex: 1 }} numberOfLines={1}>
        {ENTRY_TYPE_LABELS[undo.newType]}: {undo.text}
      </Text>
      <Pressable onPress={onUndo} hitSlop={10} accessibilityRole="button" accessibilityLabel="Undo">
        <Text style={{ color: t.dark ? t.primary : '#8FB3FF', fontSize: 15, fontWeight: '800' }}>Undo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  typeBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  durBadge: { position: 'absolute', bottom: -4, right: -6, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  durText: { fontSize: 11, fontWeight: '800' },
  undoAbove: { position: 'absolute', top: -56, left: 12, right: 12, zIndex: 11 },
  undoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
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
