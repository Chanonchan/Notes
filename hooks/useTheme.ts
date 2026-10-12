import { useColorScheme } from 'react-native';

import type { EntryType } from '../types';

const light = {
  bg: '#F7F7F5',
  card: '#FFFFFF',
  text: '#1B1B1F',
  muted: '#6B6B76',
  border: '#E3E3E8',
  primary: '#2F54C9',
  onPrimary: '#FFFFFF',
  chip: '#ECECF1',
  danger: '#B42318',
  // Neutral on purpose: types differ by icon shape; only Blocked gets a (muted) colour.
  types: { done: '#9A9AA3', in_progress: '#1B1B1F', blocked: '#B42318', next: '#1B1B1F' } as Record<EntryType, string>,
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
  danger: '#F08A7E',
  types: { done: '#7C7C88', in_progress: '#F1F1F4', blocked: '#F08A7E', next: '#F1F1F4' },
};

export type Theme = typeof light & { dark: boolean };

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? { ...dark, dark: true } : { ...light, dark: false };
}

/** Minimum touch target, per platform guidelines. */
export const TAP = 48;
