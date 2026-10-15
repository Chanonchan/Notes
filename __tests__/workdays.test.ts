import { parseWorkdays } from '../services/workdays';

describe('workdays setting', () => {
  it('parses the stored list and falls back to Mon–Sat', () => {
    expect(parseWorkdays('1,2,3,4,5')).toEqual([1, 2, 3, 4, 5]);
    expect(parseWorkdays(null)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(parseWorkdays('9,x')).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
