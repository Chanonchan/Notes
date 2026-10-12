import { useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';

import type { EntryType } from '../types';

/*
 * Palette: neutral greys for structure, ONE blue for the app (actions, icons,
 * selection, charts), and small status colours that carry meaning:
 * Done green, In progress blue, Blocked red, Next grey. Topics are neutral.
 */
const light = {
  bg: '#F5F6F8',
  card: '#FFFFFF',
  text: '#1A1C21',
  muted: '#6B7280',
  border: '#E3E5EA',
  primary: '#2F6FEB',
  onPrimary: '#FFFFFF',
  chip: '#EDEFF3',
  danger: '#D93A2B',
  types: { done: '#22A06B', in_progress: '#2F6FEB', blocked: '#D93A2B', next: '#8A919E' } as Record<EntryType, string>,
};

const dark: typeof light = {
  // Charcoal rather than near-black, so dark mode doesn't feel heavy.
  bg: '#1A1C21',
  card: '#25282F',
  text: '#F2F3F5',
  muted: '#A1A7B3',
  border: '#343842',
  primary: '#5B92F5',
  onPrimary: '#FFFFFF',
  chip: '#30343C',
  danger: '#F2766A',
  types: { done: '#3DC48A', in_progress: '#5B92F5', blocked: '#F2766A', next: '#A1A7B3' },
};

export type Theme = typeof light & { dark: boolean };

// --- Appearance override (Automatic / Light / Dark), shared app-wide ---------
export type Appearance = 'auto' | 'light' | 'dark';
let appearance: Appearance = 'auto';
const listeners = new Set<() => void>();

export function setAppearance(a: Appearance) {
  appearance = a;
  listeners.forEach((l) => l());
}

export function useAppearance(): Appearance {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => appearance,
  );
}

export function useTheme(): Theme {
  const system = useColorScheme();
  const mode = useAppearance();
  const isDark = mode === 'auto' ? system === 'dark' : mode === 'dark';
  return isDark ? { ...dark, dark: true } : { ...light, dark: false };
}

/** Minimum touch target, per platform guidelines. */
export const TAP = 48;
