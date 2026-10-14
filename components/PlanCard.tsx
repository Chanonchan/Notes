import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { createEntry, updateEntry } from '../db';
import { useDayEntries, useTopics } from '../hooks/useData';
import { useMutation } from '../hooks/useDb';
import { useEntryActions } from '../hooks/useEntryActions';
import { useTheme } from '../hooks/useTheme';
import type { DayKey, Entry } from '../types';
import { ENTRY_INSET, EntryRow } from './EntryRow';
import { GroupLabel, ListGroup } from './List';

/**
 * "Next steps": a small plan for the day. Each step is a Next entry with a
 * checkbox; new steps are typed straight into the box and go under the topic
 * currently selected in the composer.
 */
export function PlanCard({
  day,
  topicId,
  onEdit,
  onChecked,
}: {
  day: DayKey;
  topicId: number | null;
  onEdit: (entry: Entry) => void;
  onChecked?: (entry: Entry) => void;
}) {
  const t = useTheme();
  const { entries } = useDayEntries(day);
  const { byId } = useTopics(true);
  const actions = useEntryActions();
  const steps = entries.filter((e) => e.type === 'next');
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const addStep = useMutation((db, stepText: string) => createEntry(db, { topicId, text: stepText, type: 'next', day }));
  const markDone = useMutation((db, id: number) => updateEntry(db, id, { type: 'done' }));

  const submit = async () => {
    const clean = text.trim();
    if (!clean) return;
    setText('');
    await addStep(clean);
    inputRef.current?.focus();
  };

  return (
    <View>
      <GroupLabel right={steps.length ? `${steps.length}` : undefined}>Next steps</GroupLabel>
      <ListGroup inset={ENTRY_INSET}>
        {steps.map((e) => (
          <EntryRow
            key={e.id}
            entry={e}
            showTime={false}
            showType={false}
            subtitle={e.topicId != null ? byId.get(e.topicId)?.name : undefined}
            onPress={() => onEdit(e)}
            onTypePress={() => actions.open(e)}
            onCheck={async () => {
              await markDone(e.id);
              onChecked?.(e);
            }}
          />
        ))}
        <View style={styles.addRow}>
          <Ionicons name="add" size={22} color={t.primary} />
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            onSubmitEditing={submit}
            submitBehavior="submit"
            returnKeyType="done"
            placeholder="Add a next step…"
            placeholderTextColor={t.muted}
            style={[styles.input, { color: t.text }]}
            accessibilityLabel="Add a next step"
          />
        </View>
      </ListGroup>
      {actions.menu}
    </View>
  );
}

const styles = StyleSheet.create({
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, minHeight: 52 },
  input: { flex: 1, fontSize: 16, minHeight: 48 },
});
