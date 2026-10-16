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
  /** Outline around cards. Dark mode has none: the grey card on black is enough. */
  cardBorder: '#E3E5EA',
  primary: '#2F6FEB',
  onPrimary: '#FFFFFF',
  chip: '#EDEFF3',
  /** Selected segment on a chip-coloured track. */
  raised: '#FFFFFF',
  /** Bottom sheets and popups, and the edge that separates them from the dimmed page. */
  sheet: '#F5F6F8',
  sheetEdge: 'transparent',
  danger: '#D93A2B',
  types: { done: '#22A06B', in_progress: '#2F6FEB', blocked: '#D93A2B', next: '#8A919E', on_hold: '#B07800' } as Record<EntryType, string>,
};

const dark: typeof light = {
  // iPhone-style dark: black page, dark grey cards that stand clear of it,
  // neutral (untinted) greys and a slightly soft white so text doesn't glow.
  bg: '#000000',
  card: '#1C1C1E',
  text: '#E9E9EE',
  muted: '#9D9DA5',
  border: '#38383A',
  cardBorder: 'transparent',
  // Brighter blue with dark text on it, so buttons and the selected tab read clearly.
  primary: '#4D94FF',
  onPrimary: '#06142B',
  chip: '#2C2C2E',
  raised: '#3A3A3C',
  sheet: '#111113',
  sheetEdge: '#48484A',
  danger: '#FF6B5E',
  types: { done: '#34C77B', in_progress: '#4D94FF', blocked: '#FF6B5E', next: '#9D9DA5', on_hold: '#FFC53D' },
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
