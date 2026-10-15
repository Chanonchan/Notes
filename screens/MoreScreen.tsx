import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GroupLabel, ListGroup, ListRow, ScreenHeader } from '../components/List';
import { Button, Chip } from '../components/ui';
import { setSetting } from '../db';
import { useMutation, useQuery } from '../hooks/useDb';
import { useReminderTime, useWorkdays } from '../hooks/useHabits';
import { HOURLY_TIMES, REMINDER_OFF } from '../services/reminder';
import { setAppearance, useAppearance, useTheme, type Appearance } from '../hooks/useTheme';
import type { TabScreenProps } from '../types/navigation';

const APPEARANCE_ORDER: Appearance[] = ['auto', 'light', 'dark'];
const APPEARANCE_LABELS: Record<Appearance, string> = { auto: 'Automatic', light: 'Light', dark: 'Dark' };
const REMINDER_CHOICES = [REMINDER_OFF, ...HOURLY_TIMES];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** [1,2,3,4,5,6] → "Mon–Sat"; otherwise a list. */
function formatWorkdays(days: number[]): string {
  const ordered = DAY_ORDER.filter((d) => days.includes(d));
  const idx = ordered.map((d) => DAY_ORDER.indexOf(d));
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (ordered.length > 2 && contiguous) return `${SHORT[ordered[0]]}–${SHORT[ordered[ordered.length - 1]]}`;
  return ordered.map((d) => SHORT[d]).join(', ');
}

export function MoreScreen({ navigation }: TabScreenProps<'More'>) {
  const t = useTheme();
  const appearance = useAppearance();
  const saveAppearance = useMutation((db, a: Appearance) => setSetting(db, 'appearance', a === 'auto' ? null : a));
  const workdays = useWorkdays();
  const reminderTime = useReminderTime();
  const saveSetting = useMutation((db, key: 'reminder_time' | 'workdays', value: string) => setSetting(db, key, value));
  const [sheet, setSheet] = useState<'reminder' | 'workdays' | null>(null);

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.container}>
      <ScreenHeader title="More" />
      <View style={styles.body}>
        <ListGroup>
          <ListRow icon="search" title="Search" subtitle="Find any entry by words, topic, type or date" onPress={() => navigation.navigate('Search')} />
          <ListRow
            icon="cloud-download-outline"
            title="Backup & export"
            subtitle="Move your data between Safari and the app, or keep a copy"
            onPress={() => navigation.navigate('Backup')}
          />
        </ListGroup>

        <GroupLabel>Settings</GroupLabel>
        <ListGroup>
          <ListRow
            icon="notifications-outline"
            title="Daily reminder"
            subtitle="Once a day: a summary of your to-do list"
            value={reminderTime === REMINDER_OFF ? 'Off' : reminderTime}
            onPress={() => setSheet('reminder')}
          />
          <ListRow icon="calendar-outline" title="Workdays" subtitle="Days the reminder shows" value={formatWorkdays(workdays)} onPress={() => setSheet('workdays')} />
          <ListRow
            icon="contrast-outline"
            title="Appearance"
            value={APPEARANCE_LABELS[appearance]}
            onPress={() => {
              const next = APPEARANCE_ORDER[(APPEARANCE_ORDER.indexOf(appearance) + 1) % APPEARANCE_ORDER.length];
              setAppearance(next);
              void saveAppearance(next);
            }}
            chevron={false}
            accessibilityHint="Switches between Automatic, Light and Dark"
          />
        </ListGroup>

      </View>

      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(null)} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: t.sheet, borderColor: t.sheetEdge }]}>
          <Text style={[styles.sheetTitle, { color: t.text }]}>{sheet === 'reminder' ? 'Daily reminder' : 'Workdays'}</Text>
          {sheet === 'reminder' ? (
            <View style={styles.hours}>
              {REMINDER_CHOICES.map((c) => (
                <View key={c} style={c === REMINDER_OFF ? styles.offCell : styles.hourCell}>
                  <Chip
                    label={c === REMINDER_OFF ? 'Off' : c}
                    selected={reminderTime === c}
                    accessibilityLabel={c === REMINDER_OFF ? 'Reminder off' : `Remind at ${c}`}
                    onPress={async () => {
                      await saveSetting('reminder_time', c);
                      setSheet(null);
                    }}
                  />
                </View>
              ))}
            </View>
          ) : (
            <ScrollView style={{ flexShrink: 1 }}>
              <ListGroup>
                {DAY_ORDER.map((d) => {
                  const on = workdays.includes(d);
                  return (
                    <ListRow
                      key={d}
                      title={DAY_NAMES[d]}
                      chevron={false}
                      accessibilityLabel={`${DAY_NAMES[d]}, ${on ? 'workday' : 'day off'}`}
                      onPress={() => {
                        const next = on ? workdays.filter((x) => x !== d) : [...workdays, d].sort();
                        if (next.length) void saveSetting('workdays', next.join(','));
                      }}
                      right={<Ionicons name={on ? 'checkbox' : 'square-outline'} size={24} color={on ? t.primary : t.muted} />}
                    />
                  );
                })}
              </ListGroup>
            </ScrollView>
          )}
          <Button label="Done" kind="secondary" onPress={() => setSheet(null)} style={{ marginTop: 12 }} />
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 48 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '85%', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 32 },
  sheetTitle: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  body: { paddingHorizontal: 16 },
  hours: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },
  hourCell: { width: '25%', alignItems: 'center' },
  offCell: { width: '100%', alignItems: 'flex-start', marginBottom: 4 },
});
