import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SectionTitle } from '../components/ui';
import { getCarryOver } from '../db';
import { useQuery } from '../hooks/useDb';
import { useTheme } from '../hooks/useTheme';
import { todayKey } from '../services/dates';
import type { TabScreenProps } from '../types/navigation';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function MoreScreen({ navigation }: TabScreenProps<'More'>) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const today = todayKey();
  const carry = useQuery((db) => getCarryOver(db, today), [today]).data;

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={[styles.container, { paddingTop: insets.top + 12 }]}>
      <Text style={[styles.title, { color: t.text }]}>More</Text>

      <View style={[styles.group, { backgroundColor: t.card, borderColor: t.border }]}>
        <Row icon="search" label="Search" sub="Find any entry by words, topic, type or date" onPress={() => navigation.navigate('Search')} />
        <Row
          icon="return-down-forward"
          label="Carry over open items"
          sub={carry ? `${carry.items.length} open from the last logged day` : 'Nothing open from the last logged day'}
          onPress={() => navigation.navigate('CarryOver')}
          last
        />
      </View>

      <SectionTitle>Coming next</SectionTitle>
      <View style={[styles.group, { backgroundColor: t.card, borderColor: t.border, opacity: 0.6 }]}>
        <Row icon="notifications-outline" label="Daily reminder" sub="“Anything you forgot to log today?”" />
        <Row icon="flame-outline" label="Streak" sub="Consecutive workdays logged (Mon–Sat)" />
        <Row icon="download-outline" label="Export" sub="Back up everything as JSON or plain text" last />
      </View>
    </ScrollView>
  );
}

function Row({ icon, label, sub, onPress, last }: { icon: IconName; label: string; sub: string; onPress?: () => void; last?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? t.chip : 'transparent', borderBottomColor: t.border, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: t.chip }]}>
        <Ionicons name={icon} size={20} color={t.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 17, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: t.muted, fontSize: 13 }}>{sub}</Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={20} color={t.muted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 12 },
  group: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 14, paddingVertical: 10 },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
