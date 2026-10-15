import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Composer } from '../components/Composer';
import { DayTimeline } from '../components/DayTimeline';
import { ScreenHeader } from '../components/List';
import { TodoList } from '../components/TodoList';
import { listOpenItems, OPEN_TYPES } from '../db';
import { useDayEntries } from '../hooks/useData';
import { useQuery } from '../hooks/useDb';
import { useUndo } from '../hooks/useUndo';
import { useReminder } from '../hooks/useHabits';
import { ReminderCard } from '../components/ReminderCard';
import { storageStats } from '../services/export';
import { isInstalledApp } from '../services/export/files';
import { useTheme } from '../hooks/useTheme';
import { formatDayLong, formatDuration, todayKey } from '../services/dates';
import type { TabScreenProps } from '../types/navigation';

/**
 * Home screen. Today's log fills the screen; the composer is pinned to the
 * bottom (thumb reach), like a chat app. Type and time are tucked behind
 * "options" pills since most entries are just text + topic.
 */
export function CaptureScreen({ navigation, route }: TabScreenProps<'Log'>) {
  const t = useTheme();
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const today = todayKey();
  const { entries } = useDayEntries(today);
  const doneToday = entries.filter((e) => !OPEN_TYPES.includes(e.type));
  const openCount = useQuery((db) => listOpenItems(db)).data?.length ?? 0;
  // Fresh home-screen install with an empty log: point to the Safari → app move.
  const totalEntries = useQuery((db) => storageStats(db), []).data?.entries;
  const showMoveHint = Platform.OS === 'web' && isInstalledApp() && totalEntries === 0;
  const reminder = useReminder();

  const { undo, offer: offerUndo, run: runUndo } = useUndo();

  // Opened from the reminder notification (or anywhere asking for focus).
  useEffect(() => {
    if (route.params?.focus) {
      const id = setTimeout(() => inputRef.current?.focus(), 300);
      navigation.setParams({ focus: undefined });
      return () => clearTimeout(id);
    }
  }, [route.params?.focus, navigation]);

  const totalMinutes = entries.reduce((s, e) => s + (e.durationMinutes ?? 0), 0);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader
        title="Today"
        subtitle={[
          formatDayLong(today),
          entries.length ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}` : null,
          totalMinutes ? formatDuration(totalMinutes) : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        right={
          <View style={styles.headerRight}>
            <Pressable onPress={() => navigation.navigate('Search')} accessibilityRole="button" accessibilityLabel="Search" hitSlop={10} style={styles.iconBtn}>
              <Ionicons name="search" size={24} color={t.text} />
            </Pressable>
          </View>
        }
      />

      {reminder.show ? (
        <View style={styles.banner}>
          <ReminderCard onClose={reminder.close} />
        </View>
      ) : null}


      {/* Today's log */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <TodoList onEdit={(e) => navigation.navigate('EntryEdit', { entryId: e.id })} onChecked={offerUndo} />
        {doneToday.length ? (
          <>
            <Text style={[styles.sectionTitle, { color: t.text }]}>Today's log</Text>
            <DayTimeline
              day={today}
              excludeTypes={OPEN_TYPES}
              emptyText=""
              onEdit={(e) => navigation.navigate('EntryEdit', { entryId: e.id })}
              onChecked={(e) => offerUndo(e)}
            />
          </>
        ) : openCount ? (
          <Text style={[styles.hint, { color: t.muted }]}>Nothing done yet today. Log it in the box below.</Text>
        ) : !entries.length ? (
          <View style={styles.empty}>
            <Ionicons name="sunny-outline" size={44} color={t.muted} />
            <Text style={[styles.emptyTitle, { color: t.text }]}>Nothing logged yet today</Text>
            <Text style={[styles.emptyText, { color: t.muted }]}>
              Type what you did in the box below and tap the arrow.{'\n'}Tap an entry later to edit it.
            </Text>
            {showMoveHint ? (
              <Pressable onPress={() => navigation.navigate('Backup')} accessibilityRole="button" hitSlop={8} style={styles.moveHint}>
                <Ionicons name="swap-horizontal" size={18} color={t.primary} />
                <Text style={{ color: t.primary, fontSize: 15, fontWeight: '700' }}>Used DayLog in Safari? Bring your entries here</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <Composer
        inputRef={inputRef}
        undo={undo}
        onUndo={runUndo}
        onAdded={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  banner: { paddingHorizontal: 16, paddingTop: 4 },
  list: { paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1 },
  sectionTitle: { fontSize: 20, fontWeight: '800', marginTop: 28, marginBottom: -8, paddingHorizontal: 4 },
  hint: { fontSize: 14, marginTop: 24, paddingHorizontal: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  moveHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, minHeight: 44 },
});
