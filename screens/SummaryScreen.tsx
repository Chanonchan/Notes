import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateRangeModal } from '../components/DateRangeModal';
import { SegmentedControl } from '../components/SegmentedControl';
import { TimeBarChart } from '../components/TimeBarChart';
import { ENTRY_INSET, EntryRow, TypeIcon } from '../components/EntryRow';
import { GroupLabel, ListGroup, ListRow, ScreenHeader } from '../components/List';
import { Chip } from '../components/ui';
import { getSetting, setSetting } from '../db';
import { useMutation, useQuery } from '../hooks/useDb';
import { useTheme } from '../hooks/useTheme';
import { formatDuration, todayKey, weekdayShort } from '../services/dates';
import { showError } from '../services/dialogs';
import { copyText, shareText } from '../services/share';
import {
  buildSummary,
  formatRange,
  formatSummaryText,
  formatTopicLine,
  rangeFor,
  rangeLength,
  shiftRange,
  type RangeKind,
  type Summary,
  type SummaryRange,
  type TopicSummary,
} from '../services/summary';
import type { EntryType } from '../types';
import type { TabScreenProps } from '../types/navigation';

const KINDS: { value: RangeKind; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'custom', label: 'Custom' },
];
// Blocked items get their own section, so topic cards leave them out.
const TYPE_ORDER: EntryType[] = ['done', 'in_progress', 'next'];

export function SummaryScreen({ navigation }: TabScreenProps<'Summary'>) {
  const t = useTheme();
  const today = todayKey();
  const [range, setRange] = useState<SummaryRange>(() => rangeFor('week', today));
  const [picking, setPicking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const { data: summary } = useQuery((db) => buildSummary(db, range), [range.kind, range.from, range.to]);
  const generated = summary ? formatSummaryText(summary) : '';
  // A hand-edited version of this period's text, if any (saved on the phone).
  const draftKey = `summary_draft:${range.kind}:${range.from}:${range.to}` as const;
  const { data: draftRaw } = useQuery((db) => getSetting(db, draftKey), [draftKey]);
  const draft = useMemo(() => {
    try {
      return draftRaw ? (JSON.parse(draftRaw) as { text: string; base: string }) : null;
    } catch {
      return null;
    }
  }, [draftRaw]);
  const text = draft?.text ?? generated;
  const staleDraft = !!draft && draft.base !== generated;
  const saveDraft = useMutation((db, value: string | null) => setSetting(db, draftKey, value));
  const [editing, setEditing] = useState(false);
  const insets = useSafeAreaInsets();
  const [editText, setEditText] = useState('');

  const setKind = (kind: RangeKind) => {
    if (kind === 'custom') {
      setRange({ kind: 'custom', from: range.from, to: range.to > today ? today : range.to });
      setPicking(true);
    } else {
      setRange(rangeFor(kind, today));
    }
  };
  const isCurrent = range.from <= today && today <= range.to;
  const canGoNext = range.to < today;

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 1800);
  };
  const copy = async () => {
    try {
      await copyText(text);
      flash('Copied to clipboard');
    } catch (e) {
      showError('Could not copy', e);
    }
  };
  const share = async () => {
    try {
      const res = await shareText(text, `Work summary · ${formatRange(range)}`);
      if (res === 'copied') flash('Sharing not available here, so it was copied instead');
    } catch (e) {
      showError('Could not share', e);
    }
  };

  const showChart = range.kind === 'month' || (range.kind === 'custom' && rangeLength(range) >= 14);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader
          title="Summary"
          right={
            summary && summary.totals.entries ? (
              <Pressable
                onPress={() => setMenuOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Copy, share or edit the summary"
                hitSlop={10}
                style={[styles.shareBtn, { backgroundColor: t.card, borderColor: t.border }]}
              >
                <Ionicons name="share-outline" size={22} color={t.primary} />
              </Pressable>
            ) : null
          }
        />
        <View style={styles.body}>
        <SegmentedControl options={KINDS} value={range.kind} onChange={setKind} />

        <View style={styles.rangeRow}>
          <Chip label="◀" accessibilityLabel="Previous period" onPress={() => setRange(shiftRange(range, -1))} />
          <Pressable
            style={styles.rangeLabel}
            onPress={() => range.kind === 'custom' && setPicking(true)}
            disabled={range.kind !== 'custom'}
            accessibilityRole={range.kind === 'custom' ? 'button' : 'text'}
          >
            <Text style={[styles.rangeText, { color: t.text }]} numberOfLines={2}>
              {formatRange(range)}
            </Text>
            {range.kind === 'custom' ? (
              <Text style={{ color: t.primary, fontSize: 13, fontWeight: '700' }}>Change dates</Text>
            ) : !isCurrent ? (
              <Text style={{ color: t.primary, fontSize: 13, fontWeight: '700' }} onPress={() => setRange(rangeFor(range.kind as Exclude<RangeKind, 'custom'>, today))}>
                Back to {range.kind === 'day' ? 'today' : `this ${range.kind}`}
              </Text>
            ) : null}
          </Pressable>
          <Chip
            label="▶"
            accessibilityLabel="Next period"
            onPress={() => canGoNext && setRange(shiftRange(range, 1))}
          />
        </View>

        {summary ? <SummaryBody summary={summary} showChart={showChart} onOpenEntry={(id) => navigation.navigate('EntryEdit', { entryId: id })} /> : null}

        </View>
      </ScrollView>

      {notice ? (
        <View style={[styles.notice, { backgroundColor: t.text }]} pointerEvents="none">
          <Text style={{ color: t.bg, fontWeight: '700' }}>{notice}</Text>
        </View>
      ) : null}

      {/* Copy / share / edit, kept out of the way until the share button is tapped. */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} accessibilityLabel="Close menu">
          <View style={[styles.menu, { backgroundColor: t.sheet, borderColor: t.sheetEdge, borderWidth: 1, top: insets.top + 56 }]}>
            <ListGroup>
              <ListRow
                icon="copy-outline"
                title="Copy as text"
                chevron={false}
                onPress={() => {
                  setMenuOpen(false);
                  void copy();
                }}
              />
              <ListRow
                icon="share-outline"
                title="Share"
                chevron={false}
                onPress={() => {
                  setMenuOpen(false);
                  void share();
                }}
              />
              <ListRow
                icon="create-outline"
                title={draft ? 'Edit text · edited' : 'Edit text'}
                subtitle={staleDraft ? 'Your log changed since you edited' : undefined}
                chevron={false}
                onPress={() => {
                  setMenuOpen(false);
                  setEditText(text);
                  setEditing(true);
                }}
              />
            </ListGroup>
            {draft ? <Text style={[styles.menuNote, { color: t.muted }]}>Copy and Share use your edited text.</Text> : null}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={editing} animationType="slide" onRequestClose={() => setEditing(false)}>
        <View style={[styles.editor, { backgroundColor: t.bg, paddingTop: insets.top + 4, paddingBottom: insets.bottom }]}>
          <View style={[styles.editorBar, { borderBottomColor: t.border }]}>
            <Pressable
              onPress={() => {
                setEditText(generated);
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Reset to original"
            >
              <Text style={{ color: t.danger, fontSize: 16, fontWeight: '600' }}>Reset</Text>
            </Pressable>
            <Text style={[styles.editorTitle, { color: t.text }]}>Edit summary</Text>
            <Pressable
              onPress={async () => {
                // Matching the generated text again means "not edited".
                await saveDraft(editText === generated ? null : JSON.stringify({ text: editText, base: generated }));
                setEditing(false);
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Save summary"
            >
              <Text style={{ color: t.primary, fontSize: 16, fontWeight: '800' }}>Done</Text>
            </Pressable>
          </View>
          <Text style={[styles.editorHint, { color: t.muted }]}>
            {formatRange(range)} · Copy and Share will use this text. Your entries are not changed.
          </Text>
          <TextInput
            value={editText}
            onChangeText={setEditText}
            multiline
            autoFocus
            autoCorrect
            style={[styles.editorInput, { color: t.text, backgroundColor: t.card, borderColor: t.border }]}
            accessibilityLabel="Summary text"
          />
        </View>
      </Modal>

      <DateRangeModal
        visible={picking}
        from={range.from}
        to={range.to}
        onClose={() => setPicking(false)}
        onApply={(from, to) => {
          setRange({ kind: 'custom', from, to });
          setPicking(false);
        }}
      />
    </View>
  );
}

function SummaryBody({ summary, showChart, onOpenEntry }: { summary: Summary; showChart: boolean; onOpenEntry: (id: number) => void }) {
  const t = useTheme();
  const { totals } = summary;
  const singleDay = summary.range.from === summary.range.to;
  const totalsLine = [
    `${totals.entries} ${totals.entries === 1 ? 'entry' : 'entries'}`,
    totals.minutes ? formatDuration(totals.minutes) : null,
    `${totals.topics} ${totals.topics === 1 ? 'topic' : 'topics'}`,
    !singleDay ? `${totals.days} ${totals.days === 1 ? 'day' : 'days'}` : null,
  ]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <View>
      {totals.entries ? (
        <Text style={[styles.totals, { color: t.text }]}>{totalsLine}</Text>
      ) : (
        <Text style={[styles.nothing, { color: t.muted }]}>Nothing logged in this period.</Text>
      )}

      {showChart && totals.entries ? (
        <>
          <GroupLabel>Time per topic</GroupLabel>
          <ListGroup style={styles.chartCard}>
            <TimeBarChart topics={summary.topics} />
          </ListGroup>
        </>
      ) : null}

      {summary.topics.map((s) => (
        <TopicSummaryCard key={s.topic?.id ?? 'none'} s={s} summary={summary} onOpenEntry={onOpenEntry} />
      ))}

      {summary.blocked.length ? (
        <>
          <GroupLabel right={`${summary.blocked.length}`}>Blocked</GroupLabel>
          <ListGroup inset={ENTRY_INSET}>
            {summary.blocked.map(({ entry, topic }) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                showTime={false}
                showType={false}
                subtitle={[topic?.name ?? 'No topic', singleDay ? null : `${weekdayShort(entry.day)} ${Number(entry.day.slice(8))}`]
                  .filter(Boolean)
                  .join(' · ')}
                onPress={() => onOpenEntry(entry.id)}
                onTypePress={() => onOpenEntry(entry.id)}
              />
            ))}
          </ListGroup>
        </>
      ) : null}

      {summary.openItems.length ? (
        <>
          <GroupLabel>Still open</GroupLabel>
          <ListGroup inset={ENTRY_INSET}>
            {summary.openItems.map(({ entry, topic }) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                showTime={false}
                subtitle={[topic?.name ?? 'No topic', singleDay ? null : `${weekdayShort(entry.day)} ${Number(entry.day.slice(8))}`]
                  .filter(Boolean)
                  .join(' · ')}
                onPress={() => onOpenEntry(entry.id)}
                onTypePress={() => onOpenEntry(entry.id)}
              />
            ))}
          </ListGroup>
        </>
      ) : null}

      {summary.untouched.length ? (
        <>
          <GroupLabel>Not touched</GroupLabel>
          <Text style={[styles.untouched, { color: t.muted }]}>{summary.untouched.map((x) => x.name).join(', ')}</Text>
        </>
      ) : null}
    </View>
  );
}

function TopicSummaryCard({ s, summary, onOpenEntry }: { s: TopicSummary; summary: Summary; onOpenEntry: (id: number) => void }) {
  const t = useTheme();
  const line = formatTopicLine(s, summary);
  const detail = line.slice(line.indexOf(': ') + 2).replace(/, \d+h( \d+m)?$|, \d+m$/, '');
  return (
    <ListGroup style={styles.topicCard}>
      <View style={styles.topicInner}>
        <View style={styles.topicHead}>
          <Text style={[styles.topicName, { color: t.text }]} numberOfLines={1}>
            {s.topic?.name ?? 'No topic'}
          </Text>
          {s.totalMinutes ? <Text style={{ color: t.muted, fontSize: 15 }}>{formatDuration(s.totalMinutes)}</Text> : null}
        </View>
        <Text style={{ color: t.muted, fontSize: 14, marginBottom: 6 }}>{detail}</Text>
        {TYPE_ORDER.flatMap((type) =>
          s.items[type].map((item, i) => (
            <Pressable
              key={`${type}-${i}`}
              onPress={() => onOpenEntry(s.itemIds[type][i])}
              accessibilityRole="button"
              accessibilityHint="Opens the entry to edit it"
              style={({ pressed }) => [styles.item, { backgroundColor: pressed ? t.chip : 'transparent' }]}
            >
              <TypeIcon type={type} size={18} />
              <Text style={{ color: t.text, fontSize: 15, lineHeight: 21, flex: 1 }}>{item}</Text>
            </Pressable>
          )),
        )}
      </View>
    </ListGroup>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 32 },
  body: { paddingHorizontal: 16 },
  chartCard: { padding: 14 },
  totals: { fontSize: 16, fontWeight: '600', textAlign: 'center', marginTop: 14 },
  nothing: { fontSize: 15, textAlign: 'center', marginTop: 24 },
  topicCard: { marginTop: 14 },
  topicInner: { padding: 14, gap: 4 },
  topicHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topicDot: { width: 10, height: 10, borderRadius: 5 },
  topicName: { flex: 1, fontSize: 17, fontWeight: '700' },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 3 },
  untouched: { fontSize: 15, lineHeight: 22, paddingHorizontal: 4 },
  editor: { flex: 1 },
  editorBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  editorTitle: { fontSize: 17, fontWeight: '700' },
  editorHint: { fontSize: 13, paddingHorizontal: 16, paddingTop: 10 },
  editorInput: { flex: 1, margin: 16, borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 15, lineHeight: 22, textAlignVertical: 'top' },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  rangeLabel: { flex: 1, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  rangeText: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  notice: { position: 'absolute', bottom: 16, left: 24, right: 24, alignItems: 'center', borderRadius: 18, paddingVertical: 10, paddingHorizontal: 12 },
  shareBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  menu: { position: 'absolute', right: 12, width: 260, borderRadius: 18, padding: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  menuNote: { fontSize: 12, paddingHorizontal: 8, paddingTop: 6, paddingBottom: 2 },
});
