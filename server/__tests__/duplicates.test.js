const { normalizeString, isDuplicate, flagDuplicates } = require('../lib/duplicates');

describe('normalizeString', () => {
  test('lowercases and strips non-alphanumeric chars', () => {
    expect(normalizeString("McDonald's")).toBe('mcdonalds');
    expect(normalizeString('In-N-Out Burger')).toBe('innoutburger');
  });

  test('returns empty string for falsy input', () => {
    expect(normalizeString(null)).toBe('');
    expect(normalizeString('')).toBe('');
    expect(normalizeString(undefined)).toBe('');
  });
});

describe('isDuplicate', () => {
  const existing = [
    { name: 'Chipotle', address: '123 Main St', google_place_id: 'ChIJ_abc' },
    { name: "McDonald's", address: '456 Oak Ave', google_place_id: null },
  ];

  test('detects duplicate by google_place_id', () => {
    const place = { place_id: 'ChIJ_abc', name: 'Different Name', address: 'Different Address' };
    expect(isDuplicate(place, existing)).toBe(true);
  });

  test('detects duplicate by name + address match', () => {
    const place = { place_id: 'ChIJ_new', name: "mcdonald's", address: '456 Oak Ave' };
    expect(isDuplicate(place, existing)).toBe(true);
  });

  test('does not flag non-duplicates', () => {
    const place = { place_id: 'ChIJ_xyz', name: 'Totally New', address: '999 Elm St' };
    expect(isDuplicate(place, existing)).toBe(false);
  });

  test('does not match on name alone', () => {
    const place = { place_id: 'ChIJ_xyz', name: 'Chipotle', address: '999 Different St' };
    expect(isDuplicate(place, existing)).toBe(false);
  });
});

describe('flagDuplicates', () => {
  const existing = [
    { name: 'Chipotle', address: '123 Main St', google_place_id: 'ChIJ_abc' },
  ];

  test('flags duplicates with already_added', () => {
    const places = [
      { place_id: 'ChIJ_abc', name: 'Chipotle', address: '123 Main St' },
      { place_id: 'ChIJ_new', name: 'New Place', address: '789 Elm St' },
    ];
    const result = flagDuplicates(places, existing);
    expect(result[0].already_added).toBe(true);
    expect(result[1].already_added).toBe(false);
  });

  test('preserves original place data', () => {
    const places = [{ place_id: 'ChIJ_new', name: 'New Place', address: '789 Elm St', rating: 4.2 }];
    const result = flagDuplicates(places, existing);
    expect(result[0].name).toBe('New Place');
    expect(result[0].rating).toBe(4.2);
  });
});
