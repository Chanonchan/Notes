import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { listOpenItems } from '../db';
import { useTopics } from '../hooks/useData';
import { useQuery } from '../hooks/useDb';
import { useTheme } from '../hooks/useTheme';
import { groupOpenItems } from '../services/reminder';

const MAX_TOPICS = 5;
const MAX_ITEMS = 3;

/**
 * The daily reminder: a read-only summary of open jobs by topic.
 * Tapping anywhere on it closes it.
 */
export function ReminderCard({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  const { data: items } = useQuery((db) => listOpenItems(db));
  const { byId } = useTopics(true);
  if (!items) return null;

  const groups = groupOpenItems(items, (id) => byId.get(id)?.name);
  const inProgress = items.filter((e) => e.type === 'in_progress').length;
  const planned = items.length - inProgress;
  const counts = [inProgress ? `${inProgress} in progress` : null, planned ? `${planned} planned` : null].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={onClose}
      accessibilityRole="button"
      accessibilityLabel="Close reminder"
      style={({ pressed }) => [styles.card, { backgroundColor: t.card, borderColor: t.cardBorder, opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={styles.head}>
        <Ionicons name="notifications" size={20} color={t.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: t.text }]}>Today's to-do</Text>
          <Text style={{ color: t.muted, fontSize: 14 }}>{items.length ? counts : 'Nothing in progress or planned'}</Text>
        </View>
        <Ionicons name="close" size={22} color={t.muted} />
      </View>

      {groups.slice(0, MAX_TOPICS).map((g) => {
        const lines = [
          ...g.inProgress.map((text) => ({ text, color: t.types.in_progress })),
          ...g.planned.map((text) => ({ text, color: t.types.next })),
        ];
        return (
          <View key={g.topic} style={styles.group}>
            <Text style={[styles.topic, { color: t.text }]}>
              {g.topic}
              <Text style={{ color: t.muted, fontWeight: '500' }}>
                {'  '}
                {[g.inProgress.length ? `${g.inProgress.length} in progress` : null, g.planned.length ? `${g.planned.length} planned` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </Text>
            {lines.slice(0, MAX_ITEMS).map((l, i) => (
              <View key={i} style={styles.line}>
                <View style={[styles.dot, { backgroundColor: l.color }]} />
                <Text style={{ color: t.text, fontSize: 15, flex: 1 }} numberOfLines={1}>
                  {l.text}
                </Text>
              </View>
            ))}
            {lines.length > MAX_ITEMS ? <Text style={[styles.more, { color: t.muted }]}>+{lines.length - MAX_ITEMS} more</Text> : null}
          </View>
        );
      })}
      {groups.length > MAX_TOPICS ? (
        <Text style={[styles.more, { color: t.muted }]}>+{groups.length - MAX_TOPICS} more topics</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 17, fontWeight: '700' },
  group: { gap: 4 },
  topic: { fontSize: 15, fontWeight: '700' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 2 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  more: { fontSize: 13, paddingLeft: 17 },
});
