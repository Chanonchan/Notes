import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DateRangeModal } from '../components/DateRangeModal';
import { SegmentedControl } from '../components/SegmentedControl';
import { TimeBarChart } from '../components/TimeBarChart';
import { TypeTile } from '../components/EntryRow';
import { GroupLabel, ListGroup, ListRow, ScreenHeader, tint } from '../components/List';
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
import { ENTRY_TYPE_LABELS, type EntryType } from '../types';
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

  return (
    <View>
      <View style={styles.tiles}>
        <Tile value={String(totals.entries)} label={totals.entries === 1 ? 'entry' : 'entries'} />
        <Tile value={totals.minutes ? formatDuration(totals.minutes) : '—'} label="time" wide />
        {!singleDay ? <Tile value={String(totals.days)} label={totals.days === 1 ? 'day' : 'days'} /> : null}
        <Tile value={String(totals.topics)} label={totals.topics === 1 ? 'topic' : 'topics'} />
      </View>

      {!totals.entries ? (
        <ListGroup style={{ marginTop: 16 }}>
          <ListRow icon="cafe-outline" iconColor={t.muted} title="Nothing logged in this period" subtitle="Use ◀ to look at an earlier one." />
        </ListGroup>
      ) : null}

      {showChart && totals.entries ? (
        <>
          <GroupLabel>Time per topic</GroupLabel>
          <ListGroup style={styles.chartCard}>
            <TimeBarChart topics={summary.topics} />
          </ListGroup>
        </>
      ) : null}

      {summary.topics.map((s) => (
        <TopicSummaryGroup key={s.topic?.id ?? 'none'} s={s} summary={summary} />
      ))}

      {summary.openItems.length ? (
        <>
          <GroupLabel right={`${summary.openItems.length}`}>Still open</GroupLabel>
          <ListGroup>
            {summary.openItems.map(({ entry, topic }) => (
              <ListRow
                key={entry.id}
                leading={<TypeTile type={entry.type} />}
                title={entry.text}
                subtitle={[ENTRY_TYPE_LABELS[entry.type], topic?.name ?? 'No topic', singleDay ? null : `${weekdayShort(entry.day)} ${Number(entry.day.slice(8))}`]
                  .filter(Boolean)
                  .join(' · ')}
                onPress={() => onOpenEntry(entry.id)}
              />
            ))}
          </ListGroup>
        </>
      ) : null}

      {summary.untouched.length ? (
        <>
          <GroupLabel right={`${summary.untouched.length}`}>Not touched</GroupLabel>
          <ListGroup>
            {summary.untouched.map((topic) => (
              <ListRow
                key={topic.id}
                icon="pricetag"
                iconColor={topic.color}
                iconBg={tint(topic.color, t.dark ? 0.22 : 0.14)}
                title={topic.name}
                titleLines={1}
                subtitle="Nothing logged in this period"
              />
            ))}
          </ListGroup>
        </>
      ) : null}
    </View>
  );
}

function TopicSummaryGroup({ s, summary }: { s: TopicSummary; summary: Summary }) {
  const t = useTheme();
  const line = formatTopicLine(s, summary);
  const detail = line.slice(line.indexOf(': ') + 2);
  const counts = TYPE_ORDER.filter((type) => s.counts[type])
    .map((type) => `${ENTRY_TYPE_LABELS[type]} ${s.counts[type]}`)
    .join(' · ');
  return (
    <>
      <GroupLabel dot={s.topic?.color ?? t.muted} right={s.totalMinutes ? formatDuration(s.totalMinutes) : undefined}>
        {s.topic?.name ?? 'No topic'}
      </GroupLabel>
      <ListGroup>
        <ListRow icon="stats-chart" iconColor={t.muted} title={detail} subtitle={counts} />
        {TYPE_ORDER.flatMap((type) =>
          s.items[type].map((item, i) => (
            <ListRow key={`${type}-${i}`} leading={<TypeTile type={type} />} title={item} subtitle={ENTRY_TYPE_LABELS[type]} />
          )),
        )}
      </ListGroup>
    </>
  );
}

function Tile({ value, label, wide }: { value: string; label: string; wide?: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: t.card, borderColor: t.border }, wide && { flex: 1.5 }]}>
      <Text style={[styles.tileValue, { color: t.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={{ color: t.muted, fontSize: 12 }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 32 },
  body: { paddingHorizontal: 16 },
  chartCard: { padding: 14 },
  previewBox: { padding: 14 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  rangeLabel: { flex: 1, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  rangeText: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  tiles: { flexDirection: 'row', gap: 8, marginTop: 14 },
  tile: { flex: 1, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center' },
  tileValue: { fontSize: 19, fontWeight: '800' },
  preview: { fontFamily: 'monospace', fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
  notice: { position: 'absolute', top: -46, alignSelf: 'center', left: 24, right: 24, alignItems: 'center', borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12 },
});
