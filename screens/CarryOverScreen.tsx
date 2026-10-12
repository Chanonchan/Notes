import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ListGroup, ListRow } from '../components/List';
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
        <Ionicons name="checkmark-circle" size={48} color={t.muted} />
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

        <ListGroup style={styles.list}>
          {carry.items.map((e) => {
            const on = selected.has(e.id);
            const topic = e.topicId != null ? byId.get(e.topicId) : undefined;
            return (
              <ListRow
                key={e.id}
                leading={<Ionicons name={on ? 'checkbox' : 'square-outline'} size={28} color={on ? t.primary : t.muted} />}
                title={e.text}
                subtitle={`${ENTRY_TYPE_LABELS[e.type]} · ${topic?.name ?? 'No topic'}`}
                onPress={() => toggle(e.id)}
                chevron={false}
                accessibilityLabel={`${e.text}, ${on ? 'selected' : 'not selected'}`}
              />
            );
          })}
        </ListGroup>
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
  list: { marginTop: 18 },
  note: { fontSize: 13, marginTop: 14 },
  actions: { gap: 10, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
