import { useTheme } from '../hooks/useTheme';
import { formatDuration, formatTime } from '../services/dates';
import { ENTRY_TYPE_LABELS, type Entry, type EntryType } from '../types';
import { IconTile, ListRow, tint, type IconName } from './List';

/** Distinct shapes per type, so the type never relies on colour alone. */
export const TYPE_ICONS: Record<EntryType, IconName> = {
  done: 'checkmark-circle',
  in_progress: 'time',
  blocked: 'alert-circle',
  next: 'arrow-forward-circle',
};

export function TypeTile({ type, onPress }: { type: EntryType; onPress?: () => void }) {
  const t = useTheme();
  return (
    <IconTile
      icon={TYPE_ICONS[type]}
      color={t.types[type]}
      bg={tint(t.types[type], t.dark ? 0.22 : 0.14)}
      onPress={onPress}
      label={`Type: ${ENTRY_TYPE_LABELS[type]}. Tap to change.`}
    />
  );
}

/** One entry as a list row: type tile · text · "Done · 09:30 · 1h · #tag". */
export function EntryRow({
  entry,
  onPress,
  onTypePress,
  showTime = true,
  subtitle,
}: {
  entry: Entry;
  onPress: () => void;
  /** Tap on the type tile (or long-press the row) — quick type change. */
  onTypePress: () => void;
  showTime?: boolean;
  /** Extra context, e.g. the topic name in search results. */
  subtitle?: string;
}) {
  const details = [
    ENTRY_TYPE_LABELS[entry.type],
    subtitle,
    showTime ? formatTime(entry.createdAt) : null,
    entry.durationMinutes ? formatDuration(entry.durationMinutes) : null,
    ...entry.tags.map((x) => `#${x}`),
  ].filter(Boolean);

  return (
    <ListRow
      leading={<TypeTile type={entry.type} onPress={onTypePress} />}
      title={entry.text}
      subtitle={details.join(' · ')}
      onPress={onPress}
      onLongPress={onTypePress}
      accessibilityHint="Opens the entry for editing. Long-press to change its type."
    />
  );
}
