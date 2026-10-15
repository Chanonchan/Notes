import { useEffect, useState } from 'react';

import { getSetting, setSetting } from '../db';
import { todayKey } from '../services/dates';
import { DEFAULT_REMINDER_TIME, shouldShowReminder } from '../services/reminder';
import { parseWorkdays } from '../services/workdays';
import type { Entry } from '../types';
import { useMutation, useQuery } from './useDb';

export function useWorkdays() {
  return parseWorkdays(useQuery((db) => getSetting(db, 'workdays')).data ?? null);
}

export function useReminderTime(): string {
  return useQuery((db) => getSetting(db, 'reminder_time')).data ?? DEFAULT_REMINDER_TIME;
}

/** In-app end-of-day reminder for Today. Re-checks every minute while open. */
export function useReminder(todayEntries: Entry[]) {
  const today = todayKey();
  const time = useReminderTime();
  const workdays = useWorkdays();
  const { data: dismissedDay } = useQuery((db) => getSetting(db, 'reminder_dismissed_day'));
  const dismiss = useMutation((db) => setSetting(db, 'reminder_dismissed_day', today));
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const lastEntryAt = todayEntries.reduce<number | null>((m, e) => (m === null || e.createdAt > m ? e.createdAt : m), null);
  const show =
    dismissedDay !== undefined &&
    shouldShowReminder({ now, today, time, workdays, dismissedDay: dismissedDay ?? null, lastEntryAt });

  return { show, dismiss, time };
}
