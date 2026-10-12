import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { DateRangeModal } from '../components/DateRangeModal';
import { EntryRow } from '../components/EntryRow';
import { TopicSheet } from '../components/TopicPicker';
import { Card, Chip, SectionTitle } from '../components/ui';
import { isEmptySearch, searchEntries, type SearchFilters } from '../db';
import { useTopics } from '../hooks/useData';
import { useQuery } from '../hooks/useDb';
import { useEntryActions } from '../hooks/useEntryActions';
import { TAP, useTheme } from '../hooks/useTheme';
import { addDays, formatDayLong, formatRelativeDay, todayKey } from '../services/dates';
import { ENTRY_TYPES, ENTRY_TYPE_LABELS, type DayKey, type Entry, type EntryType } from '../types';
import type { RootScreenProps } from '../types/navigation';

type DatePreset = 'any' | '7' | '30' | 'year' | 'custom';
const DATE_PRESETS: { value: Exclude<DatePreset, 'custom'>; label: string }[] = [
  { value: 'any', label: 'Any time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: 'year', label: 'This year' },
];
const LIMIT = 200;

export function SearchScreen({ navigation }: RootScreenProps<'Search'>) {
  const t = useTheme();
  const today = todayKey();
  const { byId } = useTopics(true);
  const actions = useEntryActions();

  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [topicId, setTopicId] = useState<number | undefined>(undefined);
  const [type, setType] = useState<EntryType | undefined>(undefined);
  const [preset, setPreset] = useState<DatePreset>('any');
  const [custom, setCustom] = useState<{ from: DayKey; to: DayKey }>({ from: addDays(today, -30), to: today });
  const [pickingTopic, setPickingTopic] = useState(false);
  const [pickingDates, setPickingDates] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  // Search as you type, without querying on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setQuery(text), 250);
    return () => clearTimeout(id);
  }, [text]);

  const filters: SearchFilters = useMemo(() => {
    const f: SearchFilters = { query, topicId, type, limit: LIMIT };
    if (preset === '7') f.from = addDays(today, -6);
    if (preset === '30') f.from = addDays(today, -29);
    if (preset === 'year') f.from = `${today.slice(0, 4)}-01-01`;
    if (preset === 'custom') Object.assign(f, custom);
    return f;
  }, [query, topicId, type, preset, custom, today]);

  const empty = isEmptySearch(filters);
  const { data: results } = useQuery(
    (db) => (empty ? Promise.resolve([] as Entry[]) : searchEntries(db, filters)),
    [JSON.stringify(filters), empty],
  );

  const byDay = new Map<string, Entry[]>();
  for (const e of results ?? []) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);
  const topic = topicId !== undefined ? byId.get(topicId) : undefined;
  const words = query.trim().split(/\s+/).filter(Boolean);
  const anyFilter = topicId !== undefined || type || preset !== 'any';

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[styles.top, { borderBottomColor: t.border }]}>
        <View style={[styles.searchBox, { backgroundColor: t.card, borderColor: t.border }]}>
          <Ionicons name="search" size={20} color={t.muted} />
          <TextInput
            autoFocus
            value={text}
            onChangeText={setText}
            placeholder="Search your log"
            placeholderTextColor={t.muted}
            returnKeyType="search"
            autoCorrect={false}
            style={[styles.searchInput, { color: t.text }]}
            accessibilityLabel="Search text"
          />
          {text ? (
            <Pressable onPress={() => setText('')} hitSlop={10} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={20} color={t.muted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} keyboardShouldPersistTaps="handled">
          <FilterButton
            label={topic ? topic.name : 'Any topic'}
            dot={topic?.color}
            active={topicId !== undefined}
            onPress={() => setPickingTopic(true)}
            onClear={topicId !== undefined ? () => setTopicId(undefined) : undefined}
          />
          <FilterButton
            label={preset === 'custom' ? `${custom.from.slice(5)} → ${custom.to.slice(5)}` : DATE_PRESETS.find((p) => p.value === preset)!.label}
            active={preset !== 'any'}
            onPress={() => setPickingDates(true)}
            onClear={preset !== 'any' ? () => setPreset('any') : undefined}
          />
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} keyboardShouldPersistTaps="handled">
          <Chip label="All types" selected={!type} onPress={() => setType(undefined)} />
          {ENTRY_TYPES.map((x) => (
            <Chip key={x} label={ENTRY_TYPE_LABELS[x]} color={t.types[x]} selected={type === x} onPress={() => setType(type === x ? undefined : x)} />
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.results} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {empty ? (
          <View style={styles.hint}>
            <Ionicons name="search-outline" size={40} color={t.muted} />
            <Text style={[styles.hintTitle, { color: t.text }]}>Find anything you logged</Text>
            <Text style={[styles.hintText, { color: t.muted }]}>
              Type a word, or pick a topic, type or date range above.{'\n'}Tip: choose “Blocked” to see everything that got stuck.
            </Text>
          </View>
        ) : results && !results.length ? (
          <Text style={[styles.none, { color: t.muted }]}>
            No entries found{words.length ? ` for “${words.join(' ')}”` : ''}
            {anyFilter ? ' with these filters' : ''}.
          </Text>
        ) : results ? (
          <>
            <Text style={{ color: t.muted, marginBottom: 4 }}>
              {results.length >= LIMIT ? `Showing the newest ${LIMIT} results` : `${results.length} ${results.length === 1 ? 'result' : 'results'}`}
            </Text>
            {[...byDay].map(([day, list]) => (
              <View key={day}>
                <SectionTitle>
                  {formatRelativeDay(day, today)}
                  {formatRelativeDay(day, today) !== formatDayLong(day) ? ` · ${formatDayLong(day)}` : ''}
                </SectionTitle>
                <Card style={styles.dayCard}>
                  {list.map((e) => {
                    const tp = e.topicId != null ? byId.get(e.topicId) : undefined;
                    return (
                      <EntryRow
                        key={e.id}
                        entry={e}
                        subtitle={tp?.name ?? 'No topic'}
                        onPress={() => navigation.navigate('EntryEdit', { entryId: e.id })}
                        onTypePress={() => actions.open(e)}
                      />
                    );
                  })}
                </Card>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
      {actions.menu}

      <TopicSheet
        visible={pickingTopic}
        value={topicId ?? null}
        title="Filter by topic"
        noneLabel="Any topic"
        onClose={() => setPickingTopic(false)}
        onPick={(id) => {
          setTopicId(id ?? undefined);
          setPickingTopic(false);
        }}
      />
      <DatePresetSheet
        visible={pickingDates}
        value={preset}
        onClose={() => setPickingDates(false)}
        onPick={(p) => {
          setPickingDates(false);
          if (p === 'custom') setCustomOpen(true);
          else setPreset(p);
        }}
      />
      <DateRangeModal
        visible={customOpen}
        from={custom.from}
        to={custom.to}
        onClose={() => setCustomOpen(false)}
        onApply={(from, to) => {
          setCustom({ from, to });
          setPreset('custom');
          setCustomOpen(false);
        }}
      />
    </View>
  );
}

function FilterButton({
  label,
  dot,
  active,
  onPress,
  onClear,
}: {
  label: string;
  dot?: string;
  active: boolean;
  onPress: () => void;
  onClear?: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.filterBtn, { backgroundColor: active ? t.card : t.chip, borderColor: active ? t.primary : 'transparent' }]}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      <Text style={{ color: t.text, fontSize: 15, fontWeight: '600', maxWidth: 170 }} numberOfLines={1}>
        {label}
      </Text>
      {onClear ? (
        <Pressable onPress={onClear} hitSlop={10} accessibilityLabel={`Clear ${label} filter`}>
          <Ionicons name="close" size={16} color={t.muted} />
        </Pressable>
      ) : (
        <Ionicons name="chevron-down" size={16} color={t.muted} />
      )}
    </Pressable>
  );
}

function DatePresetSheet({
  visible,
  value,
  onClose,
  onPick,
}: {
  visible: boolean;
  value: DatePreset;
  onClose: () => void;
  onPick: (p: DatePreset) => void;
}) {
  const t = useTheme();
  const options: { value: DatePreset; label: string }[] = [...DATE_PRESETS, { value: 'custom', label: 'Custom range…' }];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: t.card }]}>
        <Text style={[styles.sheetTitle, { color: t.text }]}>Filter by date</Text>
        {options.map((o) => (
          <Pressable
            key={o.value}
            onPress={() => onPick(o.value)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.sheetItem, { backgroundColor: pressed || o.value === value ? t.chip : 'transparent' }]}
          >
            <Text style={{ color: t.text, fontSize: 17, fontWeight: o.value === value ? '700' : '500', flex: 1 }}>{o.label}</Text>
            {o.value === value ? <Ionicons name="checkmark" size={22} color={t.primary} /> : null}
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  top: { padding: 12, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, minHeight: 50 },
  searchInput: { flex: 1, fontSize: 17, minHeight: 48 },
  filters: { gap: 8, paddingRight: 8 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, borderRadius: 20, paddingHorizontal: 14, borderWidth: 1.5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  results: { padding: 16, paddingBottom: 48 },
  hint: { alignItems: 'center', gap: 8, paddingVertical: 48 },
  hintTitle: { fontSize: 18, fontWeight: '700' },
  hintText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  none: { textAlign: 'center', paddingVertical: 40, fontSize: 15 },
  dayCard: { paddingHorizontal: 8, paddingVertical: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 32 },
  sheetTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  sheetItem: { minHeight: TAP + 4, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderRadius: 12 },
});
