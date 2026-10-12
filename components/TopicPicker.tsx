import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listTopicStats } from '../db';
import { ListGroup, ListRow } from './List';
import { useQuery } from '../hooks/useDb';
import { useTheme } from '../hooks/useTheme';
import { formatRelativeDay } from '../services/dates';
import type { Topic } from '../types';

interface Props {
  topics: Topic[];
  value: number | null;
  onChange: (id: number | null) => void;
  onCreate: (name: string) => Promise<Topic>;
  /** Topic suggested from the entry text; shown as a one-tap chip. */
  suggestedId?: number | null;
}

/**
 * One button showing the current topic. Tapping it opens a list of all
 * topics (most recently used first) with search and inline create.
 */
export function TopicPicker({ topics, value, onChange, onCreate, suggestedId }: Props) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const selected = topics.find((x) => x.id === value);
  const suggested = suggestedId != null && suggestedId !== value ? topics.find((x) => x.id === suggestedId) : undefined;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Topic: ${selected?.name ?? 'none'}. Tap to choose.`}
        style={({ pressed }) => [styles.button, { backgroundColor: pressed ? t.border : t.chip }]}
      >
        <Ionicons name="pricetag-outline" size={16} color={t.muted} />
        <Text style={[styles.buttonText, { color: selected ? t.text : t.muted }]} numberOfLines={1}>
          {selected?.name ?? 'Choose topic'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={t.muted} />
      </Pressable>

      {suggested ? (
        <Pressable
          onPress={() => onChange(suggested.id)}
          accessibilityRole="button"
          accessibilityLabel={`Use suggested topic ${suggested.name}`}
          style={[styles.suggest, { borderColor: t.border }]}
        >
          <Text style={{ fontSize: 13 }}>✨</Text>
          <Text style={{ color: t.text, fontSize: 15, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>
            {suggested.name}?
          </Text>
        </Pressable>
      ) : null}

      <TopicSheet
        visible={open}
        value={value}
        onClose={() => setOpen(false)}
        onPick={(id) => {
          onChange(id);
          setOpen(false);
        }}
        onCreate={async (name) => {
          const topic = await onCreate(name);
          onChange(topic.id);
          setOpen(false);
        }}
      />
    </View>
  );
}

/** Bottom-sheet topic list. Also used as a filter (e.g. Search) with `onCreate` omitted. */
export function TopicSheet({
  visible,
  value,
  onClose,
  onPick,
  onCreate,
  noneLabel = 'No topic',
  title = 'Choose topic',
}: {
  visible: boolean;
  value: number | null;
  onClose: () => void;
  onPick: (id: number | null) => void;
  /** Omit to hide "Create …". */
  onCreate?: (name: string) => Promise<void>;
  /** Label of the first row, which picks `null`. */
  noneLabel?: string;
  title?: string;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  // Most recently active first (listTopicStats' order).
  const { data } = useQuery((db) => listTopicStats(db));
  const all = data ?? [];

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => (q ? all.filter((s) => s.topic.name.toLowerCase().includes(q)) : all), [all, q]);
  const exact = all.some((s) => s.topic.name.toLowerCase() === q);

  const close = () => {
    setQuery('');
    onClose();
  };
  const create = async () => {
    if (!q || !onCreate) return;
    const name = query.trim();
    setQuery('');
    await onCreate(name);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close topic list" />
      <View style={[styles.sheet, { backgroundColor: t.bg, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: t.text }]}>{title}</Text>
          <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={t.muted} />
          </Pressable>
        </View>

        <View style={[styles.search, { backgroundColor: t.card, borderColor: t.border }]}>
          <Ionicons name="search" size={18} color={t.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => (filtered.length === 1 && !exact ? onPick(filtered[0].topic.id) : create())}
            placeholder={onCreate ? 'Search or type a new topic' : 'Search topics'}
            placeholderTextColor={t.muted}
            returnKeyType="done"
            style={[styles.searchInput, { color: t.text }]}
            accessibilityLabel="Search or create topic"
          />
        </View>

        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          <ListGroup>
            {q && !exact && onCreate ? (
              <ListRow icon="add-circle" title={`Create “${query.trim()}”`} accessibilityLabel={`Create “${query.trim()}”`} onPress={create} chevron={false} />
            ) : null}
            {!q ? (
              <ListRow
                icon="remove-circle-outline"
                iconColor={t.muted}
                title={noneLabel}
                accessibilityLabel={noneLabel}
                onPress={() => onPick(null)}
                chevron={false}
                right={value === null ? <Ionicons name="checkmark" size={22} color={t.primary} /> : undefined}
              />
            ) : null}
            {filtered.map((s) => (
              <ListRow
                key={s.topic.id}
                icon="pricetag-outline"
                iconColor={t.muted}
                title={s.topic.name}
                titleLines={1}
                accessibilityLabel={s.topic.name}
                subtitle={s.lastDay ? `Last used ${formatRelativeDay(s.lastDay).toLowerCase()}` : 'Not used yet'}
                onPress={() => onPick(s.topic.id)}
                chevron={false}
                right={s.topic.id === value ? <Ionicons name="checkmark" size={22} color={t.primary} /> : undefined}
              />
            ))}
          </ListGroup>
          {!q && !filtered.length ? (
            <Text style={[styles.hint, { color: t.muted }]}>
              {onCreate ? 'No topics yet. Type a name above to create your first one.' : 'No topics yet.'}
            </Text>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  button: {
    flexShrink: 1,
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  suggest: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 22,
    paddingHorizontal: 12,
    gap: 4,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '80%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '800' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 48,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 16, minHeight: 46 },
  list: { flexGrow: 0 },
  hint: { textAlign: 'center', paddingVertical: 24, fontSize: 15 },
});
