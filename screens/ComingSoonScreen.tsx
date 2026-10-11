import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';

/** Temporary tab content until the milestone that builds it. */
export function comingSoon(title: string, milestone: number) {
  return function ComingSoonScreen() {
    const t = useTheme();
    return (
      <View style={[styles.container, { backgroundColor: t.bg }]}>
        <Text style={[styles.title, { color: t.text }]}>{title}</Text>
        <Text style={{ color: t.muted, fontSize: 15 }}>Arrives in milestone {milestone}.</Text>
      </View>
    );
  };
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 22, fontWeight: '700' },
});
