import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';
import { formatDuration, parseDuration } from '../services/dates';
import { Chip } from './ui';

const PRESETS = [15, 30, 60, 120];

/** Optional duration. Tapping the selected chip again clears it. */
export function DurationChips({ value, onChange }: { value: number | null; onChange: (m: number | null) => void }) {
  const t = useTheme();
  const isCustom = value != null && !PRESETS.includes(value);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const commit = () => {
    const minutes = parseDuration(draft);
    if (minutes != null) onChange(minutes);
    setEditing(false);
  };

  return (
    <View style={styles.row}>
      {PRESETS.map((m) => (
        <Chip key={m} label={formatDuration(m)} selected={value === m} onPress={() => onChange(value === m ? null : m)} />
      ))}
      {editing ? (
        <TextInput
          autoFocus
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={commit}
          onBlur={commit}
          placeholder="e.g. 45m, 1h30"
          placeholderTextColor={t.muted}
          returnKeyType="done"
          style={[styles.input, { color: t.text, borderColor: t.primary }]}
        />
      ) : (
        <Chip
          label={isCustom ? formatDuration(value!) : 'Custom'}
          selected={isCustom}
          onPress={() => {
            if (isCustom) return onChange(null);
            setDraft('');
            setEditing(true);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { minHeight: 40, minWidth: 120, borderWidth: 2, borderRadius: 20, paddingHorizontal: 14, fontSize: 15 },
});
