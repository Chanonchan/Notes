import { useEffect, useLayoutEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { DurationChips } from '../components/DurationChips';
import { TopicPicker } from '../components/TopicPicker';
import { TypeSelector } from '../components/TypeSelector';
import { Button, Chip, SectionTitle } from '../components/ui';
import { createEntry, createTopic, deleteEntry, getEntry, getLastTopicId, updateEntry } from '../db';
import { useTopics } from '../hooks/useData';
import { useDb, useMutation } from '../hooks/useDb';
import { useTheme } from '../hooks/useTheme';
import { addDays, formatDayLong, todayKey } from '../services/dates';
import { confirmDestructive, showError } from '../services/dialogs';
import type { DayKey, EntryType } from '../types';
import type { RootScreenProps } from '../types/navigation';

export function EntryEditScreen({ navigation, route }: RootScreenProps<'EntryEdit'>) {
  const t = useTheme();
  const { db } = useDb();
  const { topics } = useTopics();
  const entryId = route.params.entryId;
  const isNew = entryId == null;

  const [loaded, setLoaded] = useState(isNew);
  const [text, setText] = useState('');
  const [topicId, setTopicId] = useState<number | null>(null);
  const [type, setType] = useState<EntryType>('done');
  const [duration, setDuration] = useState<number | null>(null);
  const [tags, setTags] = useState('');
  const [day, setDay] = useState<DayKey>(route.params.day ?? todayKey());

  useLayoutEffect(() => {
    navigation.setOptions({ title: isNew ? 'New entry' : 'Edit entry' });
  }, [navigation, isNew]);

  // New entries start on the last used topic, like quick capture.
  useEffect(() => {
    if (entryId == null) getLastTopicId(db).then(setTopicId);
  }, [db, entryId]);

  useEffect(() => {
    if (entryId == null) return;
    getEntry(db, entryId).then((e) => {
      if (!e) return navigation.goBack();
      setText(e.text);
      setTopicId(e.topicId);
      setType(e.type);
      setDuration(e.durationMinutes);
      setTags(e.tags.join(', '));
      setDay(e.day);
      setLoaded(true);
    });
  }, [db, entryId, navigation]);

  const save = useMutation(async (d) => {
    const fields = {
      topicId,
      text,
      type,
      durationMinutes: duration,
      day,
      tags: tags.split(',').map((s) => s.trim()).filter(Boolean),
    };
    if (entryId == null) await createEntry(d, fields);
    else await updateEntry(d, entryId, fields);
  });
  const remove = useMutation((d) => deleteEntry(d, entryId!));
  const addTopic = useMutation((d, name: string) => createTopic(d, name));

  if (!loaded) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  const today = todayKey();
  const onSave = async () => {
    try {
      await save();
      navigation.goBack();
    } catch (e) {
      showError('Could not save', e);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <TextInput
        value={text}
        onChangeText={setText}
        autoFocus={isNew}
        multiline
        placeholder="What did you do?"
        placeholderTextColor={t.muted}
        style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.card }]}
        accessibilityLabel="Entry text"
      />

      <SectionTitle>Day</SectionTitle>
      <View style={styles.dayRow}>
        <Chip label="◀" accessibilityLabel="Previous day" onPress={() => setDay(addDays(day, -1))} />
        <Text style={[styles.day, { color: t.text }]}>{formatDayLong(day)}</Text>
        <Chip
          label="▶"
          accessibilityLabel="Next day"
          onPress={() => day < today && setDay(addDays(day, 1))}
        />
      </View>

      <SectionTitle>Topic</SectionTitle>
      <TopicPicker topics={topics} value={topicId} onChange={setTopicId} onCreate={addTopic} />

      <SectionTitle>Type</SectionTitle>
      <TypeSelector value={type} onChange={setType} />

      <SectionTitle>Time spent</SectionTitle>
      <DurationChips value={duration} onChange={setDuration} />

      <SectionTitle>Tags</SectionTitle>
      <TextInput
        value={tags}
        onChangeText={setTags}
        placeholder="comma, separated"
        placeholderTextColor={t.muted}
        autoCapitalize="none"
        style={[styles.tags, { color: t.text, borderColor: t.border, backgroundColor: t.card }]}
        accessibilityLabel="Tags"
      />

      <View style={styles.actions}>
        <Button label="Save" onPress={onSave} disabled={!text.trim()} />
        {!isNew ? (
          <Button
            label="Delete"
            kind="danger"
            onPress={() =>
              confirmDestructive('Delete entry?', text, 'Delete', async () => {
                await remove();
                navigation.goBack();
              })
            }
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  input: { minHeight: 96, fontSize: 18, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top' },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  day: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600' },
  tags: { minHeight: 48, fontSize: 16, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  actions: { gap: 12, marginTop: 28 },
});
