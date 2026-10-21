import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';
import { formatDuration, formatTime, todayKey } from '../services/dates';
import { formatDue, type DueTone } from '../services/deadline';
import { ENTRY_TYPE_LABELS, type Entry, type EntryType } from '../types';
import { IconTile, type IconName } from './List';

/** Distinct shapes per type, so the type never relies on colour alone. */
export const TYPE_ICONS: Record<EntryType, IconName> = {
  done: 'checkmark-circle',
  in_progress: 'time',
  blocked: 'alert-circle',
  on_hold: 'pause-circle',
  next: 'arrow-forward-circle',
};

/** Divider inset for lists of EntryRows (aligns with the text). */
export const ENTRY_INSET = 50;

/** Tinted square tile — for menu-like rows (Summary "still open", carry-over). */
export function TypeTile({ type, onPress }: { type: EntryType; onPress?: () => void }) {
  const t = useTheme();
  return (
    <IconTile
      icon={TYPE_ICONS[type]}
      color={t.types[type]}
      bg={t.chip}
      onPress={onPress}
      label={`Type: ${ENTRY_TYPE_LABELS[type]}. Tap to change.`}
    />
  );
}

/** Small bare type icon. */
export function TypeIcon({ type, size = 22 }: { type: EntryType; size?: number }) {
  const t = useTheme();
  return <Ionicons name={TYPE_ICONS[type]} size={size} color={t.types[type]} />;
}

/**
 * One entry, kept quiet: type icon · text, with only time/duration below.
 * "Done" is the default so it isn't spelled out; other types are.
 */
export function EntryRow({
  entry,
  onPress,
  onTypePress,
  showTime = true,
  showType = true,
  subtitle,
  onCheck,
}: {
  entry: Entry;
  onPress: () => void;
  /** Tap on the type icon (or long-press the row) — quick type change. */
  onTypePress: () => void;
  showTime?: boolean;
  /** Hide the type word when the context already says it (e.g. the Next steps box). */
  showType?: boolean;
  /** Extra context, e.g. the topic name in search results. */
  subtitle?: string;
  /** Shows a checkbox on the right; tapping it marks the entry done. */
  onCheck?: () => void;
}) {
  const t = useTheme();
  // Deadlines only matter while the job is open.
  const due = entry.dueDay && (entry.type === 'in_progress' || entry.type === 'next') ? formatDue(entry.dueDay, todayKey()) : null;
  const dueColor = (tone: DueTone) => (tone === 'overdue' ? t.danger : tone === 'soon' ? t.star : t.muted);
  const meta = [
    showType && entry.type !== 'done' ? ENTRY_TYPE_LABELS[entry.type] : null,
    subtitle,
    showTime ? formatTime(entry.createdAt) : null,
    entry.durationMinutes ? formatDuration(entry.durationMinutes) : null,
    ...entry.tags.map((x) => `#${x}`),
  ].filter(Boolean);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onTypePress}
      accessibilityRole="button"
      accessibilityHint="Opens the entry for editing. Long-press to change its type."
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.chip : 'transparent' }]}
    >
      <Pressable
        onPress={onTypePress}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`Type: ${ENTRY_TYPE_LABELS[entry.type]}. Tap to change.`}
        style={styles.icon}
      >
        <TypeIcon type={entry.type} />
      </Pressable>
      <View style={styles.body}>
        <Text style={[styles.text, { color: t.text }, entry.starred && styles.starredText]}>{entry.text}</Text>
        {meta.length ? (
          <Text style={[styles.meta, { color: t.muted }]} numberOfLines={1}>
            {meta.join(' · ')}
          </Text>
        ) : null}
        {due ? (
          <View style={styles.due} accessibilityLabel={due.label}>
            <Ionicons name={due.tone === 'overdue' ? 'alert-circle' : 'calendar-outline'} size={14} color={dueColor(due.tone)} />
            <Text style={[styles.dueText, { color: dueColor(due.tone) }]}>{due.label}</Text>
          </View>
        ) : null}
      </View>
      {entry.starred ? <Ionicons name="star" size={16} color={t.star} style={styles.star} accessibilityLabel="Starred" /> : null}
      {onCheck ? (
        <Pressable
          onPress={onCheck}
          hitSlop={12}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: false }}
          accessibilityLabel={`Mark “${entry.text}” as done`}
          style={styles.check}
        >
          <Ionicons name="ellipse-outline" size={26} color={t.muted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 52 },
  icon: { paddingTop: 1 },
  body: { flex: 1, gap: 2 },
  text: { fontSize: 16, lineHeight: 22 },
  meta: { fontSize: 13 },
  check: { paddingLeft: 4, alignSelf: 'center' },
  star: { paddingTop: 3 },
  starredText: { fontWeight: '700' },
  due: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  dueText: { fontSize: 13, fontWeight: '700' },
});
