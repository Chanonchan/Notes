import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { addProgressNote, deleteEntry, listOpenItems, setStatus, updateEntry } from '../db';
import { useTopics } from '../hooks/useData';
import { useMutation, useQuery } from '../hooks/useDb';
import { useTheme } from '../hooks/useTheme';
import { daysBetween, formatDayLong, formatRelativeDay, todayKey } from '../services/dates';
import { confirmDestructive } from '../services/dialogs';
import { CLOSING_TYPES, ENTRY_TYPE_LABELS, type Entry, type EntryType } from '../types';
import { ENTRY_INSET, EntryRow } from './EntryRow';
import { GroupLabel, ListGroup, ListRow, type IconName } from './List';
import { Button } from './ui';

const SECTIONS: { type: EntryType; label: string }[] = [
  { type: 'in_progress', label: 'In progress' },
  { type: 'next', label: 'Planned' },
];

/** "today", "since yesterday", "since Mon 12 Oct" — how long a job has been open. */
function sinceLabel(day: string, today: string): string {
  const diff = daysBetween(day, today);
  if (diff <= 0) return 'added today';
  if (diff === 1) return 'since yesterday';
  if (diff < 7) return `since ${formatRelativeDay(day, today).toLowerCase()}`;
  return `since ${formatDayLong(day).replace(/ \d{4}$/, '')}`;
}

/**
 * Today's to-do list: every open job from any day. In progress has a
 * checkbox; planned jobs have an Update button. Nothing expires. Done and
 * Blocked close a job (it moves to that day's log).
 */
export function TodoList({
  onEdit,
  onChecked,
  topicId,
}: {
  onEdit: (entry: Entry) => void;
  /** Only this topic's jobs (topic page); then nothing is shown when it has none. */
  topicId?: number;
  /** After a job is closed (Done or Blocked), with its state before — for Undo. */
  onChecked?: (entry: Entry, newType: EntryType) => void;
}) {
  const t = useTheme();
  const today = todayKey();
  const { data: all } = useQuery((db) => listOpenItems(db));
  const items = topicId === undefined ? all : all?.filter((e) => e.topicId === topicId);
  const { byId } = useTopics(true);
  const [target, setTarget] = useState<Entry | null>(null);
  const finish = useMutation((db, id: number) => setStatus(db, id, 'done', today));

  if (!items) return null;
  if (!items.length) {
    if (topicId !== undefined) return null;
    return (
      <View>
        <GroupLabel>To-do</GroupLabel>
        <Text style={[styles.empty, { color: t.muted }]}>
          Nothing open. Log work as In progress or Next and it stays here until it's done, blocked or put on hold.
        </Text>
      </View>
    );
  }

  const done = async (e: Entry) => {
    await finish(e.id);
    onChecked?.(e, 'done');
  };

  return (
    <View>
      {SECTIONS.map(({ type, label }) => {
        const list = items.filter((e) => e.type === type);
        if (!list.length) return null;
        return (
          <View key={type}>
            <GroupLabel right={`${list.length}`}>{label}</GroupLabel>
            <ListGroup inset={ENTRY_INSET}>
              {list.map((e) => (
                <View key={e.id} style={styles.rowWrap}>
                  <View style={{ flex: 1 }}>
                    <EntryRow
                      entry={e}
                      showTime={false}
                      showType={false}
                      subtitle={[topicId === undefined && e.topicId != null ? byId.get(e.topicId)?.name : null, sinceLabel(e.day, today)].filter(Boolean).join(' · ')}
                      onPress={() => setTarget(e)}
                      onTypePress={() => setTarget(e)}
                      onCheck={type === 'in_progress' ? () => done(e) : undefined}
                    />
                  </View>
                  {type !== 'in_progress' ? (
                    <Pressable
                      onPress={() => setTarget(e)}
                      accessibilityRole="button"
                      accessibilityLabel={`Update “${e.text}”`}
                      hitSlop={8}
                      style={[styles.updateBtn, { backgroundColor: t.chip }]}
                    >
                      <Text style={{ color: t.primary, fontSize: 14, fontWeight: '700' }}>Update</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </ListGroup>
          </View>
        );
      })}

      <UpdateSheet
        job={target}
        onClose={() => setTarget(null)}
        onEdit={(e) => {
          setTarget(null);
          onEdit(e);
        }}
        onFinished={(e, type) => {
          setTarget(null);
          onChecked?.(e, type);
        }}
      />
    </View>
  );
}

/** What can happen to an open job. */
function UpdateSheet({
  job,
  onClose,
  onEdit,
  onFinished,
}: {
  job: Entry | null;
  onClose: () => void;
  onEdit: (e: Entry) => void;
  onFinished: (e: Entry, type: EntryType) => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const today = todayKey();
  const [note, setNote] = useState('');
  const [writing, setWriting] = useState(false);
  const status = useMutation((db, id: number, type: EntryType) => setStatus(db, id, type, today));
  const progress = useMutation((db, e: Entry, text: string) => addProgressNote(db, e, text, today));
  const remove = useMutation((db, id: number) => deleteEntry(db, id));
  const star = useMutation((db, id: number, starred: boolean) => updateEntry(db, id, { starred }));

  const close = () => {
    setNote('');
    setWriting(false);
    onClose();
  };
  if (!job) return null;

  const action = (icon: IconName, title: string, run: () => void, color?: string) => (
    <ListRow key={title} icon={icon} iconColor={color} title={title} chevron={false} onPress={run} accessibilityLabel={title} />
  );
  const move = (type: EntryType) => async () => {
    await status(job.id, type);
    if (CLOSING_TYPES.includes(type)) onFinished(job, type);
    else close();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: t.sheet, borderColor: t.sheetEdge, paddingBottom: insets.bottom + 16 }]}>
        <Text style={[styles.sheetTitle, { color: t.text }]} numberOfLines={2}>
          {job.text}
        </Text>
        <Text style={{ color: t.muted, marginBottom: 12 }}>
          {ENTRY_TYPE_LABELS[job.type]} · {sinceLabel(job.day, today)}
        </Text>

        {writing ? (
          <ListGroup>
            <View style={styles.noteBox}>
              <TextInput
                value={note}
                onChangeText={setNote}
                autoFocus
                multiline
                placeholder="What did you do on it today?"
                placeholderTextColor={t.muted}
                style={[styles.noteInput, { color: t.text }]}
                accessibilityLabel="Progress note"
              />
              <View style={styles.noteActions}>
                <Button label="Cancel" kind="secondary" onPress={() => setWriting(false)} style={{ flex: 1 }} />
                <Button
                  label="Save note"
                  disabled={!note.trim()}
                  onPress={async () => {
                    await progress(job, note.trim());
                    close();
                  }}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </ListGroup>
        ) : (
          <ListGroup>
            {job.type === 'next' ? action('play-circle', 'Start now', move('in_progress'), t.types.in_progress) : null}
            {action('checkmark-circle', 'Mark done', move('done'), t.types.done)}
            {action('pause-circle', 'On hold (ended, not needed)', move('on_hold'), t.types.on_hold)}
            {action('chatbox-ellipses-outline', 'Add progress note', () => setWriting(true))}
            {action('alert-circle', 'Blocked (close it as blocked)', move('blocked'), t.types.blocked)}
            {job.type === 'in_progress' ? action('arrow-undo', 'Back to planned', move('next'), t.types.next) : null}
            {action(job.starred ? 'star-outline' : 'star', job.starred ? 'Remove star' : 'Star as important', async () => {
              await star(job.id, !job.starred);
              close();
            }, t.star)}
            {action('create-outline', 'Edit…', () => onEdit(job))}
            {action('trash-outline', 'Delete', () =>
              confirmDestructive('Delete this job?', job.text, 'Delete', async () => {
                await remove(job.id);
                close();
              }),
            t.danger)}
          </ListGroup>
        )}
        {!writing ? <Button label="Cancel" kind="secondary" onPress={close} style={{ marginTop: 12 }} /> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  empty: { fontSize: 14, lineHeight: 20, paddingHorizontal: 4 },
  rowWrap: { flexDirection: 'row', alignItems: 'center' },
  updateBtn: { marginRight: 12, paddingHorizontal: 12, height: 32, borderRadius: 16, justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '90%', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16 },
  sheetTitle: { fontSize: 19, fontWeight: '800', marginBottom: 2 },
  noteBox: { padding: 12, gap: 10 },
  noteInput: { minHeight: 90, fontSize: 16, textAlignVertical: 'top' },
  noteActions: { flexDirection: 'row', gap: 10 },
});
