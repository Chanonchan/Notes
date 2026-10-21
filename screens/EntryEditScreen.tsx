import { Ionicons } from '@expo/vector-icons';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { DeadlineSheet } from '../components/DeadlineSheet';
import { DurationChips } from '../components/DurationChips';
import { GroupLabel, IconTile, ListGroup, ListRow, tint } from '../components/List';
import { TopicSheet } from '../components/TopicPicker';
import { TypeSelector } from '../components/TypeSelector';
import { createEntry, createTopicWithTags, deleteEntry, getEntry, getLastTopicId, updateEntry } from '../db';
import { useTopics } from '../hooks/useData';
import { useDb, useMutation } from '../hooks/useDb';
import { useTheme } from '../hooks/useTheme';
import { addDays, formatDayLong, todayKey } from '../services/dates';
import { formatDue } from '../services/deadline';
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
  const [starred, setStarred] = useState(false);
  const [dueDay, setDueDay] = useState<string | null>(null);
  const [pickingDue, setPickingDue] = useState(false);
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
      setStarred(e.starred);
      setDueDay(e.dueDay);
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
      starred,
      dueDay,
    };
    if (entryId == null) await createEntry(d, fields);
    else await updateEntry(d, entryId, fields);
  });
  const remove = useMutation((d) => deleteEntry(d, entryId!));
  const addTopic = useMutation((d, name: string, tags: string[]) => createTopicWithTags(d, name, tags));

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
        <ListRow
          icon={starred ? 'star' : 'star-outline'}
          iconColor={t.star}
          title="Important"
          subtitle={starred ? 'Starred: highlighted on the topic page' : 'Star it to highlight it on the topic page'}
          chevron={false}
          onPress={() => setStarred((v) => !v)}
          accessibilityLabel={starred ? 'Starred. Tap to remove the star.' : 'Not starred. Tap to star as important.'}
          right={<Ionicons name={starred ? 'star' : 'star-outline'} size={24} color={starred ? t.star : t.muted} />}
        />
      </ListGroup>

      <GroupLabel>Type</GroupLabel>
      <TypeSelector value={type} onChange={setType} />

      {type === 'in_progress' || type === 'next' ? (
        <>
          <GroupLabel>Deadline</GroupLabel>
          <ListGroup>
            <ListRow
              icon="calendar-outline"
              title={dueDay ? formatDue(dueDay, today).label : 'No deadline'}
              subtitle={dueDay ? formatDayLong(dueDay) : 'Optional. Jobs with the nearest deadline show first on Today.'}
              onPress={() => setPickingDue(true)}
              accessibilityLabel={dueDay ? `Deadline ${formatDayLong(dueDay)}. Tap to change.` : 'Add a deadline'}
              right={
                dueDay ? (
                  <Pressable onPress={() => setDueDay(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Remove deadline">
                    <Ionicons name="close-circle" size={22} color={t.muted} />
                  </Pressable>
                ) : undefined
              }
            />
          </ListGroup>
          <DeadlineSheet
            visible={pickingDue}
            value={dueDay}
            onClose={() => setPickingDue(false)}
            onPick={(d) => {
              setDueDay(d);
              setPickingDue(false);
            }}
          />
        </>
      ) : null}

      <GroupLabel>Time spent</GroupLabel>
      <DurationChips value={duration} onChange={setDuration} />


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
        onCreate={async (name, tags) => {
          const created = await addTopic(name, tags);
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
});
