import { useEffect, useState } from 'react';

import { getSetting, setSetting } from '../db';
import { todayKey } from '../services/dates';
import { DEFAULT_REMINDER_TIME, shouldShowReminder } from '../services/reminder';
import { parseWorkdays } from '../services/workdays';
import { useMutation, useQuery } from './useDb';

export function useWorkdays() {
  return parseWorkdays(useQuery((db) => getSetting(db, 'workdays')).data ?? null);
}

export function useReminderTime(): string {
  return useQuery((db) => getSetting(db, 'reminder_time')).data ?? DEFAULT_REMINDER_TIME;
}

/**
 * In-app reminder for Today: shows once a day after the reminder time and
 * stays until closed. It's marked as shown as soon as it appears, so it
 * won't come back that day even if the app is reopened.
 */
export function useReminder() {
  const today = todayKey();
  const time = useReminderTime();
  const workdays = useWorkdays();
  const { data: shownDay } = useQuery((db) => getSetting(db, 'reminder_dismissed_day'));
  const markShown = useMutation((db, day: string) => setSetting(db, 'reminder_dismissed_day', day));
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const due = shownDay !== undefined && shouldShowReminder({ now, today, time, workdays, shownDay: shownDay ?? null });
  useEffect(() => {
    if (!due) return;
    setOpen(true);
    void markShown(today);
  }, [due, today, markShown]);

  return { show: open, close: () => setOpen(false), time };
}
