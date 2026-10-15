import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { cleanTopicTags } from '../db';
import { useTheme } from '../hooks/useTheme';

/** The tags plus whatever is still typed in the box (comma separated), cleaned. */
export function withDraft(tags: string[], draft: string): string[] {
  return cleanTopicTags([...tags, ...draft.split(',')]);
}

/** Read-only row of "# tag" chips. */
export function TagChips({ tags, style }: { tags: string[]; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  if (!tags.length) return null;
  return (
    <View style={[styles.wrap, style]} accessibilityLabel={`Tags: ${tags.join(', ')}`}>
      {tags.map((tag) => (
        <View key={tag} style={[styles.chip, { backgroundColor: t.chip }]}>
          <Text style={[styles.chipText, { color: t.muted }]}>#</Text>
          <Text style={[styles.chipText, { color: t.text }]}>{tag}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Tag input: chips you can remove, plus a box where Return or a comma
 * adds the typed tag. The parent owns both the list and the typed text so
 * a tag still in the box is saved too (see `withDraft`).
 */
export function TagEditor({
  tags,
  onChange,
  draft,
  onDraftChange,
  autoFocus,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  draft: string;
  onDraftChange: (text: string) => void;
  autoFocus?: boolean;
}) {
  const t = useTheme();
  const commit = (text: string) => {
    const next = withDraft(tags, text);
    if (next.length !== tags.length) onChange(next);
    onDraftChange('');
  };

  return (
    <View style={styles.editor}>
      {tags.length ? (
        <View style={styles.wrap}>
          {tags.map((tag) => (
            <Pressable
              key={tag}
              onPress={() => onChange(tags.filter((x) => x !== tag))}
              accessibilityRole="button"
              accessibilityLabel={`Remove tag ${tag}`}
              style={[styles.chip, { backgroundColor: t.chip }]}
            >
              <Text style={[styles.chipText, { color: t.text }]}>{tag}</Text>
              <Ionicons name="close" size={14} color={t.muted} />
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={[styles.inputRow, { borderColor: t.border, backgroundColor: t.card }]}>
        <Text style={{ color: t.muted, fontSize: 16 }}>#</Text>
        <TextInput
          value={draft}
          onChangeText={(text) => (text.includes(',') ? commit(text) : onDraftChange(text))}
          onSubmitEditing={() => commit(draft)}
          blurOnSubmit={false}
          autoFocus={autoFocus}
          placeholder={tags.length ? 'Add another tag' : 'Add a tag, e.g. client name'}
          placeholderTextColor={t.muted}
          returnKeyType="done"
          style={[styles.input, { color: t.text }]}
          accessibilityLabel="Add tag"
        />
        {draft.trim() ? (
          <Pressable onPress={() => commit(draft)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Add this tag">
            <Ionicons name="add-circle" size={24} color={t.primary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, height: 28, borderRadius: 14 },
  chipText: { fontSize: 14, fontWeight: '600' },
  editor: { gap: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, minHeight: 46 },
  input: { flex: 1, fontSize: 16, minHeight: 44 },
});
