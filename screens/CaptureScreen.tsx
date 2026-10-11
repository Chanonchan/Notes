import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DayTimeline } from '../components/DayTimeline';
import { DurationChips } from '../components/DurationChips';
import { TopicPicker } from '../components/TopicPicker';
import { TypeSelector } from '../components/TypeSelector';
import { Button, Card, SectionTitle } from '../components/ui';
import { createEntry, createTopic, setLastTopicId } from '../db';
import { useLastTopicId, useTopicSuggestion, useTopics } from '../hooks/useData';
import { useMutation } from '../hooks/useDb';
import { useTheme } from '../hooks/useTheme';
import { formatDayLong, todayKey } from '../services/dates';
import type { EntryType } from '../types';
import type { TabScreenProps } from '../types/navigation';

export function CaptureScreen({ navigation, route }: TabScreenProps<'Log'>) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const { topics } = useTopics();
  const lastTopicId = useLastTopicId();

  const [text, setText] = useState('');
  const [topicId, setTopicId] = useState<number | null>(null);
  const [type, setType] = useState<EntryType>('done');
  const [duration, setDuration] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const topicTouched = useRef(false);
  const suggestedId = useTopicSuggestion(text);

  // Pre-select the last used topic once it has loaded.
  useEffect(() => {
    if (lastTopicId !== undefined && !topicTouched.current) setTopicId(lastTopicId);
  }, [lastTopicId]);

  // Opened from the reminder notification (or anywhere asking for focus).
  useEffect(() => {
    if (route.params?.focus) {
      const id = setTimeout(() => inputRef.current?.focus(), 300);
      navigation.setParams({ focus: undefined });
      return () => clearTimeout(id);
    }
  }, [route.params?.focus, navigation]);

  const add = useMutation(async (db) => {
    await createEntry(db, { topicId, text, type, durationMinutes: duration });
    await setLastTopicId(db, topicId);
  });
  const addTopic = useMutation((db, name: string) => createTopic(db, name));

  const canAdd = text.trim().length > 0 && !saving;
  const submit = async () => {
    if (!canAdd) return;
    setSaving(true);
    try {
      await add();
      setText('');
      setType('done');
      setDuration(null);
      setFlash('Logged ✓');
      setTimeout(() => setFlash(null), 1500);
    } finally {
      setSaving(false);
    }
  };

  const pickTopic = (id: number | null) => {
    topicTouched.current = true;
    setTopicId(id);
  };

  const today = todayKey();

  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 12 }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: t.text }]}>DayLog</Text>
        <Text style={[styles.date, { color: t.muted }]}>{formatDayLong(today)}</Text>
      </View>

      <Card style={styles.capture}>
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          placeholder="What did you just do?"
          placeholderTextColor={t.muted}
          multiline
          submitBehavior="submit"
          returnKeyType="done"
          onSubmitEditing={submit}
          style={[styles.input, { color: t.text, borderColor: t.border }]}
          accessibilityLabel="Entry text"
        />

        <TopicPicker
          topics={topics}
          value={topicId}
          onChange={pickTopic}
          onCreate={addTopic}
          suggestedId={suggestedId}
        />
        <TypeSelector value={type} onChange={setType} />
        <DurationChips value={duration} onChange={setDuration} />

        <Button
          label={flash ?? (saving ? 'Adding…' : 'Add')}
          onPress={submit}
          disabled={!canAdd && !flash}
        />
      </Card>

      <SectionTitle>Today</SectionTitle>
      <DayTimeline
        day={today}
        onEdit={(e) => navigation.navigate('EntryEdit', { entryId: e.id })}
        emptyText="Nothing logged today yet."
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '800' },
  date: { fontSize: 15 },
  capture: { gap: 12 },
  input: { minHeight: 64, maxHeight: 160, fontSize: 18, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top' },
});
