import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateRangeModal } from '../components/DateRangeModal';
import { SegmentedControl } from '../components/SegmentedControl';
import { TimeBarChart } from '../components/TimeBarChart';
import { Button, Card, Chip, SectionTitle } from '../components/ui';
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
  const insets = useSafeAreaInsets();
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
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 12 }]}>
        <Text style={[styles.title, { color: t.text }]}>Summary</Text>
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
            <Pressable onPress={() => setShowText((v) => !v)} style={styles.previewToggle} accessibilityRole="button">
              <Ionicons name={showText ? 'chevron-down' : 'chevron-forward'} size={16} color={t.muted} />
              <Text style={{ color: t.muted, fontWeight: '700' }}>{showText ? 'Hide' : 'Preview'} text that will be copied</Text>
            </Pressable>
            {showText ? (
              <Card>
                <Text selectable style={[styles.preview, { color: t.text }]}>
                  {text}
                </Text>
              </Card>
            ) : null}
          </>
        ) : null}
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
        <Card style={{ marginTop: 16 }}>
          <Text style={{ color: t.muted, fontSize: 15, textAlign: 'center', paddingVertical: 12 }}>
            Nothing logged in this period.
          </Text>
        </Card>
      ) : null}

      {showChart && totals.entries ? (
        <>
          <SectionTitle>Time per topic</SectionTitle>
          <Card>
            <TimeBarChart topics={summary.topics} />
          </Card>
        </>
      ) : null}

      {summary.topics.length ? <SectionTitle>By topic</SectionTitle> : null}
      <View style={{ gap: 12 }}>
        {summary.topics.map((s) => (
          <TopicSummaryCard key={s.topic?.id ?? 'none'} s={s} summary={summary} />
        ))}
      </View>

      {summary.openItems.length ? (
        <>
          <SectionTitle>Still open ({summary.openItems.length})</SectionTitle>
          <Card style={{ paddingVertical: 4 }}>
            {summary.openItems.map(({ entry, topic }) => (
              <Pressable
                key={entry.id}
                onPress={() => onOpenEntry(entry.id)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.openRow, { backgroundColor: pressed ? t.chip : 'transparent' }]}
              >
                <View style={[styles.badge, { borderColor: t.types[entry.type] }]}>
                  <Text style={[styles.badgeText, { color: t.types[entry.type] }]}>{ENTRY_TYPE_LABELS[entry.type]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontSize: 15 }}>{entry.text}</Text>
                  <Text style={{ color: t.muted, fontSize: 13 }}>
                    {[topic?.name ?? 'No topic', singleDay ? null : weekdayShort(entry.day) + ' ' + entry.day.slice(8).replace(/^0/, '')]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}

      {summary.untouched.length ? (
        <>
          <SectionTitle>Not touched ({summary.untouched.length})</SectionTitle>
          <View style={styles.untouched}>
            {summary.untouched.map((topic) => (
              <Chip key={topic.id} label={topic.name} color={topic.color} />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

function TopicSummaryCard({ s, summary }: { s: TopicSummary; summary: Summary }) {
  const t = useTheme();
  const line = formatTopicLine(s, summary);
  const detail = line.slice(line.indexOf(': ') + 2);
  return (
    <Card style={{ gap: 8 }}>
      <View style={styles.cardHeader}>
        <View style={[styles.dot, { backgroundColor: s.topic?.color ?? t.muted }]} />
        <Text style={[styles.cardTitle, { color: t.text }]} numberOfLines={1}>
          {s.topic?.name ?? 'No topic'}
        </Text>
      </View>
      <Text style={{ color: t.muted, fontSize: 14 }}>{detail}</Text>
      <View style={styles.counts}>
        {TYPE_ORDER.filter((type) => s.counts[type]).map((type) => (
          <View key={type} style={styles.count}>
            <View style={[styles.countDot, { backgroundColor: t.types[type] }]} />
            <Text style={{ color: t.text, fontSize: 13, fontWeight: '600' }}>
              {ENTRY_TYPE_LABELS[type]} {s.counts[type]}
            </Text>
          </View>
        ))}
      </View>
      {TYPE_ORDER.filter((type) => s.items[type].length).map((type) => (
        <View key={type} style={styles.items}>
          <Text style={[styles.itemsLabel, { color: t.muted }]}>{ENTRY_TYPE_LABELS[type]}</Text>
          {s.items[type].map((item, i) => (
            <Text key={i} style={{ color: t.text, fontSize: 15, lineHeight: 21 }}>
              • {item}
            </Text>
          ))}
        </View>
      ))}
    </Card>
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
  container: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 12 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  rangeLabel: { flex: 1, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  rangeText: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  tiles: { flexDirection: 'row', gap: 8, marginTop: 14 },
  tile: { flex: 1, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center' },
  tileValue: { fontSize: 19, fontWeight: '800' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  cardTitle: { fontSize: 18, fontWeight: '800', flexShrink: 1 },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  countDot: { width: 9, height: 9, borderRadius: 5 },
  items: { gap: 2 },
  itemsLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 10 },
  badge: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  untouched: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  previewToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, marginBottom: 8, minHeight: 40 },
  preview: { fontFamily: 'monospace', fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
  notice: { position: 'absolute', top: -46, alignSelf: 'center', left: 24, right: 24, alignItems: 'center', borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12 },
});
