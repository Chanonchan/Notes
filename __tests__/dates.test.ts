import { addDays, formatDuration, parseDuration, toDayKey } from '../services/dates';

describe('dates', () => {
  it('formats local day keys and adds days across month ends', () => {
    expect(toDayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('formats durations', () => {
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(120)).toBe('2h');
    expect(formatDuration(210)).toBe('3h 30m');
  });

  it.each([
    ['90', 90],
    ['45m', 45],
    ['2h', 120],
    ['1.5h', 90],
    ['1h30', 90],
    ['1h 30m', 90],
    ['1:15', 75],
    ['', null],
    ['abc', null],
    ['0', null],
    ['30h', null],
  ])('parses %p as %p', (input, expected) => {
    expect(parseDuration(input)).toBe(expected);
  });
});
