import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { DurationChips } from '../components/DurationChips';
import { GroupLabel, IconTile, ListGroup, ListRow, tint } from '../components/List';
import { TopicSheet } from '../components/TopicPicker';
import { TypeSelector } from '../components/TypeSelector';
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
  const [pickingTopic, setPickingTopic] = useState(false);

  // Save lives top right; the ref keeps the header button on the latest form state.
  const onSaveRef = useRef<() => void>(() => {});
  const canSave = loaded && !!text.trim();
  useLayoutEffect(() => {
    navigation.setOptions({
      title: isNew ? 'New entry' : 'Edit entry',
      headerRight: () => (
        <Pressable
          onPress={() => canSave && onSaveRef.current()}
          disabled={!canSave}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Save"
          accessibilityState={{ disabled: !canSave }}
          style={{ paddingHorizontal: 8 }}
        >
          <Text style={{ color: canSave ? t.primary : t.muted, fontSize: 17, fontWeight: '700' }}>Save</Text>
        </Pressable>
      ),
    });
  }, [navigation, isNew, canSave, t.primary, t.muted]);

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

  const onSave = async () => {
    try {
      await save();
      navigation.goBack();
    } catch (e) {
      showError('Could not save', e);
    }
  };
  onSaveRef.current = onSave;

  if (!loaded) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  const today = todayKey();

  const topic = topics.find((x) => x.id === topicId);

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <ListGroup>
        <TextInput
          value={text}
          onChangeText={setText}
          autoFocus={isNew}
          multiline
          placeholder="What did you do?"
          placeholderTextColor={t.muted}
          style={[styles.input, { color: t.text }]}
          accessibilityLabel="Entry text"
        />
      </ListGroup>

      <GroupLabel>Details</GroupLabel>
      <ListGroup>
        <ListRow
          icon="pricetag-outline"
          title="Topic"
          value={topic?.name ?? 'No topic'}
          onPress={() => setPickingTopic(true)}
          accessibilityLabel={`Topic: ${topic?.name ?? 'none'}. Tap to choose.`}
        />
        <ListRow
          icon="calendar"
          title="Day"
          subtitle={formatDayLong(day)}
          chevron={false}
          right={
            <View style={styles.dayButtons}>
              <IconTile icon="chevron-back" color={t.text} onPress={() => setDay(addDays(day, -1))} label="Previous day" />
              <IconTile
                icon="chevron-forward"
                color={day < today ? t.text : t.border}
                onPress={() => day < today && setDay(addDays(day, 1))}
                label="Next day"
              />
            </View>
          }
        />
      </ListGroup>

      <GroupLabel>Type</GroupLabel>
      <TypeSelector value={type} onChange={setType} />

      <GroupLabel>Time spent</GroupLabel>
      <DurationChips value={duration} onChange={setDuration} />

      <GroupLabel>Tags</GroupLabel>
      <ListGroup>
        <View style={styles.tagsRow}>
          <IconTile icon="pricetags-outline" color={t.primary} />
          <TextInput
            value={tags}
            onChangeText={setTags}
            placeholder="comma, separated"
            placeholderTextColor={t.muted}
            autoCapitalize="none"
            style={[styles.tags, { color: t.text }]}
            accessibilityLabel="Tags"
          />
        </View>
      </ListGroup>

      {!isNew ? (
        <ListGroup style={{ marginTop: 28 }}>
          <ListRow
            icon="trash-outline"
            title="Delete entry"
            destructive
            chevron={false}
            iconBg={tint(t.danger, 0.12)}
            onPress={() =>
              confirmDestructive('Delete entry?', text, 'Delete', async () => {
                await remove();
                navigation.goBack();
              })
            }
          />
        </ListGroup>
      ) : null}

      <TopicSheet
        visible={pickingTopic}
        value={topicId}
        onClose={() => setPickingTopic(false)}
        onPick={(id) => {
          setTopicId(id);
          setPickingTopic(false);
        }}
        onCreate={async (name) => {
          const created = await addTopic(name);
          setTopicId(created.id);
          setPickingTopic(false);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  input: { minHeight: 110, fontSize: 18, lineHeight: 25, padding: 14, textAlignVertical: 'top' },
  dayButtons: { flexDirection: 'row', gap: 8 },
  tagsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, minHeight: 60 },
  tags: { flex: 1, fontSize: 16, minHeight: 48 },
});
