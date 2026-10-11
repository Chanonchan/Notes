import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { Db } from './db/client';
import { openExpoDb } from './db/expoDb';
import { migrate } from './db/migrations';
import { DbProvider } from './hooks/useDb';
import { useTheme } from './hooks/useTheme';
import { CaptureScreen } from './screens/CaptureScreen';
import { comingSoon } from './screens/ComingSoonScreen';
import { EntryEditScreen } from './screens/EntryEditScreen';
import type { RootStackParamList, TabParamList } from './types/navigation';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

type IconName = ComponentProps<typeof Ionicons>['name'];
const TAB_ICONS: Record<keyof TabParamList, IconName> = {
  Log: 'create-outline',
  History: 'calendar-outline',
  Summary: 'stats-chart-outline',
  Topics: 'pricetags-outline',
  More: 'ellipsis-horizontal',
};

const HistoryScreen = comingSoon('History', 2);
const SummaryScreen = comingSoon('Summaries', 4);
const TopicsScreen = comingSoon('Topics', 2);
const MoreScreen = comingSoon('Search, settings & export', 3);

function Tabs() {
  const t = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border, minHeight: 60 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarIcon: ({ color, size }) => <Ionicons name={TAB_ICONS[route.name]} color={color} size={size} />,
      })}
    >
      <Tab.Screen name="Log" component={CaptureScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Summary" component={SummaryScreen} />
      <Tab.Screen name="Topics" component={TopicsScreen} />
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
  );
}

function Root() {
  const t = useTheme();
  const navTheme = t.dark ? DarkTheme : DefaultTheme;
  return (
    <NavigationContainer
      theme={{ ...navTheme, colors: { ...navTheme.colors, background: t.bg, card: t.card, text: t.text, primary: t.primary, border: t.border } }}
    >
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack.Navigator>
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="EntryEdit" component={EntryEditScreen} options={{ presentation: 'modal' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const t = useTheme();
  const [db, setDb] = useState<Db | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const opened = await openExpoDb();
      await migrate(opened);
      setDb(opened);
    })().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (!db) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg, padding: 24 }}>
        {error ? <Text style={{ color: t.danger }}>Database error: {error}</Text> : <ActivityIndicator />}
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <DbProvider db={db}>
        <Root />
      </DbProvider>
    </SafeAreaProvider>
  );
}
