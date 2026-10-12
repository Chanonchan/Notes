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

  // The current choice comes first so it's always visible without scrolling.
  const selected = topics.find((x) => x.id === value);
  const rest = useMemo(() => topics.filter((x) => x.id !== value), [topics, value]);
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
          {selected ? (
            <Chip label={selected.name} color={selected.color} selected onPress={() => onChange(null)} />
          ) : (
            <Chip label="No topic" selected onPress={() => onChange(null)} />
          )}
          {suggested ? (
            <Pressable
              onPress={() => onChange(suggested.id)}
              accessibilityRole="button"
              accessibilityLabel={`Use suggested topic ${suggested.name}`}
              style={[styles.suggest, { borderColor: suggested.color }]}
            >
              <Text style={{ fontSize: 13 }}>✨</Text>
              <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
                {suggested.name}?
              </Text>
            </Pressable>
          ) : null}
          <Chip label="+ New topic" onPress={() => setCreating(true)} accessibilityLabel="Create new topic" />
          {rest.map((topic) => (
            <Chip key={topic.id} label={topic.name} color={topic.color} onPress={() => onChange(topic.id)} />
          ))}
          {selected ? <Chip label="No topic" onPress={() => onChange(null)} /> : null}
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
    minHeight: 40,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 20,
    paddingHorizontal: 12,
    gap: 4,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
