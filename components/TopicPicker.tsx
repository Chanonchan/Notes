import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listTopicStats } from '../db';
import { useQuery } from '../hooks/useDb';
import { TAP, useTheme } from '../hooks/useTheme';
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
        <View style={[styles.dot, { backgroundColor: selected?.color ?? t.muted }]} />
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
          style={[styles.suggest, { borderColor: suggested.color }]}
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

function TopicSheet({
  visible,
  value,
  onClose,
  onPick,
  onCreate,
}: {
  visible: boolean;
  value: number | null;
  onClose: () => void;
  onPick: (id: number | null) => void;
  onCreate: (name: string) => Promise<void>;
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
    if (!q) return;
    const name = query.trim();
    setQuery('');
    await onCreate(name);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close topic list" />
      <View style={[styles.sheet, { backgroundColor: t.card, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: t.text }]}>Choose topic</Text>
          <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={t.muted} />
          </Pressable>
        </View>

        <View style={[styles.search, { backgroundColor: t.bg, borderColor: t.border }]}>
          <Ionicons name="search" size={18} color={t.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => (filtered.length === 1 && !exact ? onPick(filtered[0].topic.id) : create())}
            placeholder="Search or type a new topic"
            placeholderTextColor={t.muted}
            returnKeyType="done"
            style={[styles.searchInput, { color: t.text }]}
            accessibilityLabel="Search or create topic"
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(s) => String(s.topic.id)}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          ListHeaderComponent={
            <>
              {q && !exact ? (
                <Row onPress={create} label={`Create “${query.trim()}”`} icon="add-circle" iconColor={t.primary} bold />
              ) : null}
              {!q ? (
                <Row
                  onPress={() => onPick(null)}
                  label="No topic"
                  dotColor={t.border}
                  checked={value === null}
                />
              ) : null}
            </>
          }
          ListEmptyComponent={
            !q ? (
              <Text style={[styles.hint, { color: t.muted }]}>
                No topics yet. Type a name above to create your first one.
              </Text>
            ) : null
          }
          renderItem={({ item: s }) => (
            <Row
              onPress={() => onPick(s.topic.id)}
              label={s.topic.name}
              sub={s.lastDay ? `Last used ${formatRelativeDay(s.lastDay).toLowerCase()}` : 'Not used yet'}
              dotColor={s.topic.color}
              checked={s.topic.id === value}
            />
          )}
        />
      </View>
    </Modal>
  );
}

function Row({
  label,
  sub,
  onPress,
  dotColor,
  icon,
  iconColor,
  checked,
  bold,
}: {
  label: string;
  sub?: string;
  onPress: () => void;
  dotColor?: string;
  icon?: 'add-circle';
  iconColor?: string;
  checked?: boolean;
  bold?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!checked }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.item, { backgroundColor: pressed || checked ? t.chip : 'transparent' }]}
    >
      {icon ? (
        <Ionicons name={icon} size={24} color={iconColor} />
      ) : (
        <View style={[styles.bigDot, { backgroundColor: dotColor }]} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={[styles.itemText, { color: icon ? t.primary : t.text, fontWeight: bold || checked ? '700' : '500' }]} numberOfLines={1}>
          {label}
        </Text>
        {sub ? <Text style={{ color: t.muted, fontSize: 13 }}>{sub}</Text> : null}
      </View>
      {checked ? <Ionicons name="checkmark" size={22} color={t.primary} /> : null}
    </Pressable>
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
  item: { minHeight: TAP + 8, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, borderRadius: 12 },
  bigDot: { width: 18, height: 18, borderRadius: 9, marginHorizontal: 3 },
  itemText: { fontSize: 17 },
  hint: { textAlign: 'center', paddingVertical: 24, fontSize: 15 },
});
