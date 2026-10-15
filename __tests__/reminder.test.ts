import { groupOpenItems, HOURLY_TIMES, parseTime, shouldShowReminder } from '../services/reminder';
import type { Entry } from '../types';

const base = {
  today: '2026-10-15', // Thursday
  time: '17:00',
  workdays: [1, 2, 3, 4, 5, 6],
  shownDay: null,
};
const at = (h: number, m: number, day = 15) => new Date(2026, 9, day, h, m);

describe('daily reminder', () => {
  it('parses times and offers every hour', () => {
    expect(parseTime('17:30')).toBe(1050);
    expect(parseTime('9:05')).toBe(545);
    expect(parseTime('25:00')).toBeNull();
    expect(parseTime('soon')).toBeNull();
    expect(HOURLY_TIMES).toHaveLength(24);
    expect(HOURLY_TIMES[0]).toBe('00:00');
    expect(HOURLY_TIMES[23]).toBe('23:00');
  });

  it('is due on a workday from the reminder time on', () => {
    expect(shouldShowReminder({ ...base, now: at(16, 59) })).toBe(false);
    expect(shouldShowReminder({ ...base, now: at(17, 0) })).toBe(true);
    expect(shouldShowReminder({ ...base, now: at(22, 0), time: '08:00' })).toBe(true);
  });

  it('shows once a day, and stays quiet when off or on a day off', () => {
    expect(shouldShowReminder({ ...base, now: at(18, 0), shownDay: '2026-10-15' })).toBe(false);
    expect(shouldShowReminder({ ...base, now: at(18, 0), shownDay: '2026-10-14' })).toBe(true);
    expect(shouldShowReminder({ ...base, now: at(18, 0), time: 'off' })).toBe(false);
    expect(shouldShowReminder({ ...base, now: at(18, 0, 18), today: '2026-10-18' })).toBe(false); // Sunday
  });

  it('groups open jobs by topic, busiest first, no topic last', () => {
    const e = (id: number, topicId: number | null, type: Entry['type'], text: string) =>
      ({ id, topicId, type, text }) as Entry;
    const names = new Map([[1, 'Website'], [2, 'API']]);
    const groups = groupOpenItems(
      [e(1, 1, 'in_progress', 'Header'), e(2, null, 'next', 'Call bank'), e(3, 2, 'next', 'Docs'), e(4, 2, 'in_progress', 'Auth'), e(5, 2, 'next', 'Rate limit')],
      (id) => names.get(id),
    );
    expect(groups).toEqual([
      { topic: 'API', inProgress: ['Auth'], planned: ['Docs', 'Rate limit'] },
      { topic: 'Website', inProgress: ['Header'], planned: [] },
      { topic: 'No topic', inProgress: [], planned: ['Call bank'] },
    ]);
  });
});
