import { parseTime, shouldShowReminder } from '../services/reminder';

const base = {
  today: '2026-10-15', // Thursday
  time: '17:30',
  workdays: [1, 2, 3, 4, 5, 6],
  dismissedDay: null,
  lastEntryAt: null,
};
const at = (h: number, m: number, day = 15) => new Date(2026, 9, day, h, m);

describe('end-of-day reminder', () => {
  it('parses times', () => {
    expect(parseTime('17:30')).toBe(1050);
    expect(parseTime('9:05')).toBe(545);
    expect(parseTime('25:00')).toBeNull();
    expect(parseTime('soon')).toBeNull();
  });

  it('shows on a workday after the reminder time', () => {
    expect(shouldShowReminder({ ...base, now: at(17, 29) })).toBe(false);
    expect(shouldShowReminder({ ...base, now: at(17, 30) })).toBe(true);
    expect(shouldShowReminder({ ...base, now: at(21, 0) })).toBe(true);
  });

  it('stays quiet when off, dismissed, on a day off, or after logging', () => {
    expect(shouldShowReminder({ ...base, now: at(18, 0), time: 'off' })).toBe(false);
    expect(shouldShowReminder({ ...base, now: at(18, 0), dismissedDay: '2026-10-15' })).toBe(false);
    expect(shouldShowReminder({ ...base, now: at(18, 0, 18), today: '2026-10-18' })).toBe(false); // Sunday
    expect(shouldShowReminder({ ...base, now: at(18, 0), lastEntryAt: at(17, 45).getTime() })).toBe(false);
    expect(shouldShowReminder({ ...base, now: at(18, 0), lastEntryAt: at(16, 0).getTime() })).toBe(true);
  });
});
