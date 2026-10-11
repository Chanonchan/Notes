import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';
import type { Topic } from '../types';
import { Chip } from './ui';

interface Props {
  topics: Topic[];
  value: number | null;
  onChange: (id: number | null) => void;
  onCreate: (name: string) => Promise<Topic>;
  /** Topic suggested from the entry text; shown as a one-tap chip. */
  suggestedId?: number | null;
}

export function TopicPicker({ topics, value, onChange, onCreate, suggestedId }: Props) {
  const t = useTheme();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  // Selected topic first so it's always visible without scrolling.
  const ordered = useMemo(() => {
    const sel = topics.find((x) => x.id === value);
    return sel ? [sel, ...topics.filter((x) => x.id !== value)] : topics;
  }, [topics, value]);
  const suggested = suggestedId != null && suggestedId !== value ? topics.find((x) => x.id === suggestedId) : undefined;

  const create = async () => {
    const clean = name.trim();
    setCreating(false);
    setName('');
    if (!clean) return;
    const topic = await onCreate(clean);
    onChange(topic.id);
  };

  return (
    <View>
      {suggested ? (
        <Pressable
          onPress={() => onChange(suggested.id)}
          accessibilityRole="button"
          accessibilityLabel={`Use suggested topic ${suggested.name}`}
          style={[styles.suggest, { borderColor: suggested.color }]}
        >
          <Text style={{ color: t.muted, fontSize: 14 }}>Suggested: </Text>
          <View style={[styles.dot, { backgroundColor: suggested.color }]} />
          <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>{suggested.name}</Text>
          <Text style={{ color: t.primary, fontSize: 14, fontWeight: '700', marginLeft: 'auto' }}>Use</Text>
        </Pressable>
      ) : null}

      {creating ? (
        <View style={styles.createRow}>
          <TextInput
            autoFocus
            value={name}
            onChangeText={setName}
            onSubmitEditing={create}
            placeholder="New topic name"
            placeholderTextColor={t.muted}
            returnKeyType="done"
            style={[styles.input, { color: t.text, borderColor: t.primary }]}
          />
          <Chip label="Create" selected onPress={create} />
          <Chip label="Cancel" onPress={() => setCreating(false)} />
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.row}>
          <Chip label="+ New" onPress={() => setCreating(true)} accessibilityLabel="Create new topic" />
          {ordered.map((topic) => (
            <Chip
              key={topic.id}
              label={topic.name}
              color={topic.color}
              selected={topic.id === value}
              onPress={() => onChange(topic.id === value ? null : topic.id)}
            />
          ))}
          <Chip label="No topic" selected={value === null} onPress={() => onChange(null)} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingRight: 8 },
  createRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, minHeight: 40, borderWidth: 2, borderRadius: 20, paddingHorizontal: 14, fontSize: 15 },
  suggest: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 6,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
