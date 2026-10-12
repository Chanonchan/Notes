import { ScrollView, StyleSheet, View } from 'react-native';

import { GroupLabel, ListGroup, ListRow, ScreenHeader } from '../components/List';
import { getCarryOver } from '../db';
import { useQuery } from '../hooks/useDb';
import { useTheme } from '../hooks/useTheme';
import { todayKey } from '../services/dates';
import type { TabScreenProps } from '../types/navigation';

export function MoreScreen({ navigation }: TabScreenProps<'More'>) {
  const t = useTheme();
  const today = todayKey();
  const carry = useQuery((db) => getCarryOver(db, today), [today]).data;

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.container}>
      <ScreenHeader title="More" />
      <View style={styles.body}>
        <ListGroup>
          <ListRow icon="search" title="Search" subtitle="Find any entry by words, topic, type or date" onPress={() => navigation.navigate('Search')} />
          <ListRow
            icon="return-down-forward"
            title="Carry over open items"
            subtitle={carry ? `${carry.items.length} open from the last logged day` : 'Nothing open from the last logged day'}
            onPress={() => navigation.navigate('CarryOver')}
          />
          <ListRow
            icon="cloud-download-outline"
            title="Backup & export"
            subtitle="Move your data between Safari and the app, or keep a copy"
            onPress={() => navigation.navigate('Backup')}
          />
        </ListGroup>

        <GroupLabel>Coming next</GroupLabel>
        <ListGroup style={{ opacity: 0.6 }}>
          <ListRow icon="notifications-outline" title="Daily reminder" subtitle="“Anything you forgot to log today?”" />
          <ListRow icon="flame-outline" title="Streak" subtitle="Consecutive workdays logged (Mon–Sat)" />
        </ListGroup>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 48 },
  body: { paddingHorizontal: 16 },
});
