import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DateRangeModal } from '../components/DateRangeModal';
import { SegmentedControl } from '../components/SegmentedControl';
import { TimeBarChart } from '../components/TimeBarChart';
import { ENTRY_INSET, EntryRow, TypeIcon } from '../components/EntryRow';
import { GroupLabel, ListGroup, ListRow, ScreenHeader } from '../components/List';
import { Button, Chip } from '../components/ui';
import { useQuery } from '../hooks/useDb';
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
const TYPE_ORDER: EntryType[] = ['done', 'in_progress', 'blocked', 'next'];

export function SummaryScreen({ navigation }: TabScreenProps<'Summary'>) {
  const t = useTheme();
  const today = todayKey();
  const [range, setRange] = useState<SummaryRange>(() => rangeFor('week', today));
  const [picking, setPicking] = useState(false);
  const [showText, setShowText] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const { data: summary } = useQuery((db) => buildSummary(db, range), [range.kind, range.from, range.to]);
  const text = summary ? formatSummaryText(summary) : '';

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
        <ScreenHeader title="Summary" />
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

        {summary && summary.totals.entries ? (
          <>
            <GroupLabel>Copy & share</GroupLabel>
            <ListGroup>
              <ListRow
                icon="document-text-outline"
                title={showText ? 'Hide text preview' : 'Preview text'}
                subtitle="Exactly what Copy and Share will send"
                onPress={() => setShowText((v) => !v)}
                chevron={false}
                right={<Ionicons name={showText ? 'chevron-up' : 'chevron-down'} size={20} color={t.muted} />}
              />
              {showText ? (
                <View style={styles.previewBox}>
                  <Text selectable style={[styles.preview, { color: t.text }]}>
                    {text}
                  </Text>
                </View>
              ) : null}
            </ListGroup>
          </>
        ) : null}
        </View>
      </ScrollView>

      <View style={[styles.actions, { backgroundColor: t.card, borderTopColor: t.border }]}>
        {notice ? (
          <View style={[styles.notice, { backgroundColor: t.text }]} pointerEvents="none">
            <Text style={{ color: t.bg, fontWeight: '700' }}>{notice}</Text>
          </View>
        ) : null}
        <Button label="Copy as text" onPress={copy} disabled={!summary} style={{ flex: 1 }} />
        <Button label="Share" kind="secondary" onPress={share} disabled={!summary} style={{ flex: 1 }} />
      </View>

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
        <TopicSummaryCard key={s.topic?.id ?? 'none'} s={s} summary={summary} />
      ))}

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

function TopicSummaryCard({ s, summary }: { s: TopicSummary; summary: Summary }) {
  const t = useTheme();
  const line = formatTopicLine(s, summary);
  const detail = line.slice(line.indexOf(': ') + 2).replace(/, \d+h( \d+m)?$|, \d+m$/, '');
  return (
    <ListGroup style={styles.topicCard}>
      <View style={styles.topicInner}>
        <View style={styles.topicHead}>
          <View style={[styles.topicDot, { backgroundColor: s.topic?.color ?? t.muted }]} />
          <Text style={[styles.topicName, { color: t.text }]} numberOfLines={1}>
            {s.topic?.name ?? 'No topic'}
          </Text>
          {s.totalMinutes ? <Text style={{ color: t.muted, fontSize: 15 }}>{formatDuration(s.totalMinutes)}</Text> : null}
        </View>
        <Text style={{ color: t.muted, fontSize: 14, marginBottom: 6 }}>{detail}</Text>
        {TYPE_ORDER.flatMap((type) =>
          s.items[type].map((item, i) => (
            <View key={`${type}-${i}`} style={styles.item}>
              <TypeIcon type={type} size={18} />
              <Text style={{ color: t.text, fontSize: 15, lineHeight: 21, flex: 1 }}>{item}</Text>
            </View>
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
  previewBox: { padding: 14 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  rangeLabel: { flex: 1, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  rangeText: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  preview: { fontFamily: 'monospace', fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
  notice: { position: 'absolute', top: -46, alignSelf: 'center', left: 24, right: 24, alignItems: 'center', borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12 },
});
