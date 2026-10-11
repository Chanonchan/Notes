import { useColorScheme } from 'react-native';

import type { EntryType } from '../types';

const light = {
  bg: '#F7F7F5',
  card: '#FFFFFF',
  text: '#1B1B1F',
  muted: '#6B6B76',
  border: '#E3E3E8',
  primary: '#3B5BDB',
  onPrimary: '#FFFFFF',
  chip: '#ECECF1',
  danger: '#D6336C',
  types: { done: '#2F9E44', in_progress: '#1C7ED6', blocked: '#E03131', next: '#AE3EC9' } as Record<EntryType, string>,
};

const dark: typeof light = {
  bg: '#111114',
  card: '#1C1C21',
  text: '#F1F1F4',
  muted: '#9A9AA6',
  border: '#2C2C34',
  primary: '#748FFC',
  onPrimary: '#0B0B0E',
  chip: '#2A2A31',
  danger: '#F06595',
  types: { done: '#51CF66', in_progress: '#4DABF7', blocked: '#FF6B6B', next: '#DA77F2' },
};

export type Theme = typeof light & { dark: boolean };

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? { ...dark, dark: true } : { ...light, dark: false };
}

/** Minimum touch target, per platform guidelines. */
export const TAP = 48;
