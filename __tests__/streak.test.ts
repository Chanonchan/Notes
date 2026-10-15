import { computeStreak, parseWorkdays } from '../services/streak';

// Oct 2026: Mon 5 … Sat 10, Sun 11, Mon 12, Tue 13, Wed 14, Thu 15.
describe('streak (Mon–Sat workdays)', () => {
  it('counts consecutive workdays up to today', () => {
    const s = computeStreak(['2026-10-13', '2026-10-14', '2026-10-15'], '2026-10-15');
    expect(s).toMatchObject({ current: 3, best: 3, loggedToday: true, atRisk: false });
  });

  it('does not break on Sunday', () => {
    const s = computeStreak(['2026-10-09', '2026-10-10', '2026-10-12', '2026-10-13'], '2026-10-13');
    expect(s.current).toBe(4); // Fri, Sat, (Sun off), Mon, Tue
  });

  it('keeps yesterday\'s streak while today is not logged yet, and flags it', () => {
    const s = computeStreak(['2026-10-13', '2026-10-14'], '2026-10-15');
    expect(s).toMatchObject({ current: 2, loggedToday: false, atRisk: true });
  });

  it('breaks on a missed workday', () => {
    const s = computeStreak(['2026-10-12', '2026-10-14', '2026-10-15'], '2026-10-15');
    expect(s.current).toBe(2); // Tue 13 missed
    expect(s.best).toBe(2);
  });

  it('remembers the best run', () => {
    const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-15'];
    const s = computeStreak(days, '2026-10-15');
    expect(s.current).toBe(1);
    expect(s.best).toBe(5);
  });

  it('counts a logged Sunday as a bonus day', () => {
    expect(computeStreak(['2026-10-10', '2026-10-11', '2026-10-12'], '2026-10-12').current).toBe(3);
  });

  it('is zero with no entries', () => {
    expect(computeStreak([], '2026-10-15')).toMatchObject({ current: 0, best: 0, atRisk: false });
  });

  it('honours custom workdays', () => {
    // Mon–Fri: Saturday 10 is a day off.
    const s = computeStreak(['2026-10-09', '2026-10-12'], '2026-10-12', [1, 2, 3, 4, 5]);
    expect(s.current).toBe(2);
    expect(parseWorkdays('1,2,3,4,5')).toEqual([1, 2, 3, 4, 5]);
    expect(parseWorkdays(null)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
