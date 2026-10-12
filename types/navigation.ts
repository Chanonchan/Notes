import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { DayKey } from './index';

export type TabParamList = {
  Log: { focus?: boolean } | undefined;
  History: undefined;
  Summary: undefined;
  Topics: undefined;
  More: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  /** Edit an entry, or create one on `day` when no id is given. */
  EntryEdit: { entryId?: number; day?: DayKey };
  TopicDetail: { topicId: number };
  Search: undefined;
  /** Morning prompt to continue yesterday's open items. */
  CarryOver: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;
