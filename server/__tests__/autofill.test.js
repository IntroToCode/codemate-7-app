const { autofill } = require('../lib/autofill');

describe('autofill', () => {
  test('returns cuisine, price_range, and address fields', () => {
    const result = autofill('chipotle');
    expect(result).toHaveProperty('cuisine');
    expect(result).toHaveProperty('price_range');
    expect(result).toHaveProperty('address');
  });

  test('matches chipotle by name', () => {
    const result = autofill('chipotle');
    expect(result.cuisine).toBe('Mexican');
    expect(result.price_range).toBe(1);
    expect(result.address).toContain('Burrito');
  });

  test('matches shake shack (case-insensitive)', () => {
    const result = autofill('Shake Shack');
    expect(result.cuisine).toBe('American');
    expect(result.price_range).toBe(2);
  });

  test('returns empty strings and price_range 2 for unknown name', () => {
    const result = autofill('definitely not a real restaurant xyz');
    expect(result.cuisine).toBe('');
    expect(result.price_range).toBe(2);
    expect(result.address).toBe('');
  });

  test('returns defaults for empty string', () => {
    const result = autofill('');
    expect(result.price_range).toBe(2);
    expect(result.cuisine).toBe('');
  });

  test('returns defaults for null input', () => {
    const result = autofill(null);
    expect(result.price_range).toBe(2);
  });

  test('matches nobu (fine dining)', () => {
    const result = autofill('nobu');
    expect(result.cuisine).toBe('Japanese');
    expect(result.price_range).toBe(4);
  });
});
