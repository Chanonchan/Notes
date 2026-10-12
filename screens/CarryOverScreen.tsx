import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/ui';
import { continueItems, dismissCarryOver, getCarryOver } from '../db';
import { useTopics } from '../hooks/useData';
import { useMutation, useQuery } from '../hooks/useDb';
import { useTheme } from '../hooks/useTheme';
import { formatRelativeDay, todayKey } from '../services/dates';
import { ENTRY_TYPE_LABELS } from '../types';
import type { RootScreenProps } from '../types/navigation';

/** Morning prompt: continue yesterday's open items today with one tap. */
export function CarryOverScreen({ navigation }: RootScreenProps<'CarryOver'>) {
  const t = useTheme();
  const today = todayKey();
  const { byId } = useTopics(true);
  const { data: carry } = useQuery((db) => getCarryOver(db, today), [today]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [initialised, setInitialised] = useState(false);

  // Everything selected by default — usually you want to continue it all.
  useEffect(() => {
    if (carry && !initialised) {
      setSelected(new Set(carry.items.map((e) => e.id)));
      setInitialised(true);
    }
  }, [carry, initialised]);

  const doContinue = useMutation((db) => continueItems(db, carry!.items.filter((e) => selected.has(e.id)), today));
  const notToday = useMutation((db) => dismissCarryOver(db, today));

  if (carry === undefined) return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  if (carry === null) {
    return (
      <View style={[styles.done, { backgroundColor: t.bg }]}>
        <Ionicons name="checkmark-circle" size={48} color={t.types.done} />
        <Text style={[styles.title, { color: t.text, textAlign: 'center' }]}>Nothing to carry over</Text>
        <Button label="Close" kind="secondary" onPress={() => navigation.goBack()} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const n = selected.size;
  const fromLabel = formatRelativeDay(carry.fromDay, today);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.title, { color: t.text }]}>Good morning ☀️</Text>
        <Text style={[styles.subtitle, { color: t.muted }]}>
          {carry.items.length} {carry.items.length === 1 ? 'item was' : 'items were'} still open {fromLabel === 'Yesterday' ? 'yesterday' : `on ${fromLabel}`}.
          Continue {carry.items.length === 1 ? 'it' : 'them'} today?
        </Text>

        <View style={styles.list}>
          {carry.items.map((e) => {
            const on = selected.has(e.id);
            const topic = e.topicId != null ? byId.get(e.topicId) : undefined;
            return (
              <Pressable
                key={e.id}
                onPress={() => toggle(e.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                style={[styles.item, { backgroundColor: t.card, borderColor: on ? t.primary : t.border }]}
              >
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={26} color={on ? t.primary : t.muted} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: t.text, fontSize: 16 }}>{e.text}</Text>
                  <View style={styles.meta}>
                    <View style={[styles.badge, { borderColor: t.types[e.type] }]}>
                      <Text style={[styles.badgeText, { color: t.types[e.type] }]}>{ENTRY_TYPE_LABELS[e.type]}</Text>
                    </View>
                    <View style={[styles.dot, { backgroundColor: topic?.color ?? t.muted }]} />
                    <Text style={{ color: t.muted, fontSize: 13 }} numberOfLines={1}>
                      {topic?.name ?? 'No topic'}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.note, { color: t.muted }]}>
          “Next” items are added as “In progress”. You can change any of them later.
        </Text>
      </ScrollView>

      <View style={[styles.actions, { backgroundColor: t.card, borderTopColor: t.border }]}>
        <Button
          label={n ? `Continue ${n} today` : 'Select items to continue'}
          disabled={!n}
          onPress={async () => {
            await doContinue();
            navigation.goBack();
          }}
        />
        <Button
          label="Not today"
          kind="secondary"
          onPress={async () => {
            await notToday();
            navigation.goBack();
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 24 },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 16, lineHeight: 23, marginTop: 6 },
  list: { gap: 10, marginTop: 18 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 14, padding: 14, minHeight: 64 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  dot: { width: 9, height: 9, borderRadius: 5, marginLeft: 4 },
  note: { fontSize: 13, marginTop: 14 },
  actions: { gap: 10, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
