import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, DefaultTheme, NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ComponentProps } from 'react';
import { ActivityIndicator, AppState, Platform, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { Db } from './db/client';
import { openAppDb } from './db/openAppDb';
import { migrate } from './db/migrations';
import { markCarryOverPrompted, shouldPromptCarryOver } from './db/carryover';
import { DbProvider, useDb } from './hooks/useDb';
import { todayKey } from './services/dates';
import { useTheme } from './hooks/useTheme';
import { CaptureScreen } from './screens/CaptureScreen';
import { CarryOverScreen } from './screens/CarryOverScreen';
import { EntryEditScreen } from './screens/EntryEditScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { MoreScreen } from './screens/MoreScreen';
import { SearchScreen } from './screens/SearchScreen';
import { SummaryScreen } from './screens/SummaryScreen';
import { TopicDetailScreen } from './screens/TopicDetailScreen';
import { TopicsScreen } from './screens/TopicsScreen';
import type { RootStackParamList, TabParamList } from './types/navigation';

// Web: text boxes already have rounded borders; drop the browser's square focus ring.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = 'input:focus, textarea:focus { outline: none; }';
  document.head.appendChild(style);
}

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

type IconName = ComponentProps<typeof Ionicons>['name'];
const TAB_ICONS: Record<keyof TabParamList, IconName> = {
  Log: 'today-outline',
  History: 'calendar-outline',
  Summary: 'stats-chart-outline',
  Topics: 'pricetags-outline',
  More: 'ellipsis-horizontal',
};

function Tabs() {
  const t = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border, minHeight: 60 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarIcon: ({ color, size }) => <Ionicons name={TAB_ICONS[route.name]} color={color} size={size} />,
      })}
    >
      <Tab.Screen name="Log" component={CaptureScreen} options={{ title: 'Today' }} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Summary" component={SummaryScreen} />
      <Tab.Screen name="Topics" component={TopicsScreen} />
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
  );
}

function Root() {
  const t = useTheme();
  const { db } = useDb();
  const navRef = useNavigationContainerRef<RootStackParamList>();

  // First open of the day: offer yesterday's open items (once per day).
  const promptCarryOver = async () => {
    const today = todayKey();
    if (await shouldPromptCarryOver(db, today)) {
      await markCarryOverPrompted(db, today);
      if (navRef.isReady()) navRef.navigate('CarryOver');
    }
  };
  // Also when the app comes back to the foreground on a new day.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && promptCarryOver());
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);
  const navTheme = t.dark ? DarkTheme : DefaultTheme;
  return (
    <NavigationContainer
      ref={navRef}
      onReady={promptCarryOver}
      theme={{ ...navTheme, colors: { ...navTheme.colors, background: t.bg, card: t.card, text: t.text, primary: t.primary, border: t.border } }}
    >
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack.Navigator>
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="EntryEdit" component={EntryEditScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="TopicDetail" component={TopicDetailScreen} />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="CarryOver" component={CarryOverScreen} options={{ presentation: 'modal', title: 'Carry over' }} />
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
      const opened = await openAppDb();
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
