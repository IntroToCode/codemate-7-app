const { calcAverageRating } = require('../lib/ratingAvg');

describe('calcAverageRating', () => {
  test('returns null for empty array', () => {
    expect(calcAverageRating([])).toBeNull();
  });

  test('returns null for null input', () => {
    expect(calcAverageRating(null)).toBeNull();
  });

  test('returns the single rating when only one rating exists', () => {
    expect(calcAverageRating([{ score: 4 }])).toBe(4);
  });

  test('returns average of multiple ratings', () => {
    expect(calcAverageRating([{ score: 3 }, { score: 5 }])).toBe(4);
  });

  test('rounds to 1 decimal place', () => {
    expect(calcAverageRating([{ score: 1 }, { score: 2 }, { score: 3 }])).toBe(2);
    expect(calcAverageRating([{ score: 4 }, { score: 5 }, { score: 3 }])).toBe(4);
  });

  test('handles all 5-star ratings', () => {
    const ratings = [{ score: 5 }, { score: 5 }, { score: 5 }];
    expect(calcAverageRating(ratings)).toBe(5);
  });

  test('handles all 1-star ratings', () => {
    const ratings = [{ score: 1 }, { score: 1 }];
    expect(calcAverageRating(ratings)).toBe(1);
  });

  test('returns correct decimal (3.3 for 1,4,5)', () => {
    expect(calcAverageRating([{ score: 1 }, { score: 4 }, { score: 5 }])).toBe(3.3);
  });
});
