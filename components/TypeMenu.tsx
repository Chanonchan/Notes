import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { TAP, useTheme } from '../hooks/useTheme';
import { ENTRY_TYPES, ENTRY_TYPE_LABELS, type EntryType } from '../types';
import { TYPE_ICONS } from './EntryRow';

/** Bottom sheet for quickly changing an entry's type, or deleting it. */
export function TypeMenu({
  visible,
  current,
  onSelect,
  onDelete,
  onClose,
}: {
  visible: boolean;
  current?: EntryType;
  onSelect: (t: EntryType) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const t = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu">
        <View style={[styles.sheet, { backgroundColor: t.card }]}>
          <Text style={[styles.title, { color: t.muted }]}>Mark as</Text>
          {ENTRY_TYPES.map((type) => (
            <Pressable
              key={type}
              onPress={() => onSelect(type)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.item, { backgroundColor: pressed ? t.chip : 'transparent' }]}
            >
              <Ionicons name={TYPE_ICONS[type]} size={22} color={t.types[type]} />
              <Text style={[styles.label, { color: t.text, fontWeight: type === current ? '800' : '500' }]}>
                {ENTRY_TYPE_LABELS[type]}
                {type === current ? '  ✓' : ''}
              </Text>
            </Pressable>
          ))}
          {onDelete ? (
            <Pressable onPress={onDelete} accessibilityRole="button" style={styles.item}>
              <Text style={[styles.label, { color: t.danger }]}>Delete entry</Text>
            </Pressable>
          ) : null}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 12, paddingBottom: 32 },
  title: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', padding: 8 },
  item: { minHeight: TAP + 4, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: 12 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  label: { fontSize: 18 },
});
