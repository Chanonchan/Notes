/** Default workdays: Monday–Saturday (0 = Sunday … 6 = Saturday). */
export const DEFAULT_WORKDAYS = [1, 2, 3, 4, 5, 6];

export function parseWorkdays(value: string | null): number[] {
  if (!value) return DEFAULT_WORKDAYS;
  const days = value
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return days.length ? days : DEFAULT_WORKDAYS;
}
