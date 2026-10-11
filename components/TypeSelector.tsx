import { StyleSheet, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';
import { ENTRY_TYPES, ENTRY_TYPE_LABELS, type EntryType } from '../types';
import { Chip } from './ui';

export function TypeSelector({ value, onChange }: { value: EntryType; onChange: (t: EntryType) => void }) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      {ENTRY_TYPES.map((type) => (
        <Chip
          key={type}
          label={ENTRY_TYPE_LABELS[type]}
          selected={value === type}
          color={t.types[type]}
          onPress={() => onChange(type)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
