const { selectRestaurant } = require('../lib/spinAlgorithm');

const makeRestaurant = (id, active = true) => ({ id, name: `Restaurant ${id}`, active });

describe('selectRestaurant', () => {
  test('returns null when no active restaurants', () => {
    const result = selectRestaurant(
      [makeRestaurant('a', false), makeRestaurant('b', false)],
      [],
      true
    );
    expect(result.selected).toBeNull();
    expect(result.allExcluded).toBe(false);
  });

  test('returns null when restaurants array is empty', () => {
    const result = selectRestaurant([], [], true);
    expect(result.selected).toBeNull();
  });

  test('returns a restaurant when there is one active', () => {
    const restaurants = [makeRestaurant('a')];
    const result = selectRestaurant(restaurants, [], true);
    expect(result.selected).not.toBeNull();
    expect(result.selected.id).toBe('a');
  });

  test('excludes recently visited restaurant IDs when excludeRecent is true', () => {
    const restaurants = [
      makeRestaurant('a'),
      makeRestaurant('b'),
      makeRestaurant('c'),
      makeRestaurant('d'),
      makeRestaurant('e'),
      makeRestaurant('f'),
    ];
    const recentIds = ['a', 'b', 'c', 'd', 'e'];
    const result = selectRestaurant(restaurants, recentIds, true);
    expect(result.selected).not.toBeNull();
    expect(result.selected.id).toBe('f');
    expect(result.allExcluded).toBe(false);
  });

  test('does NOT exclude restaurants when excludeRecent is false', () => {
    const restaurants = [makeRestaurant('a'), makeRestaurant('b')];
    const recentIds = ['a', 'b'];
    const results = new Set();
    for (let i = 0; i < 30; i++) {
      results.add(selectRestaurant(restaurants, recentIds, false).selected.id);
    }
    expect(results.has('a') || results.has('b')).toBe(true);
  });

  test('returns allExcluded true when all active restaurants are recent', () => {
    const restaurants = [makeRestaurant('a'), makeRestaurant('b')];
    const recentIds = ['a', 'b'];
    const result = selectRestaurant(restaurants, recentIds, true);
    expect(result.selected).toBeNull();
    expect(result.allExcluded).toBe(true);
  });

  test('works when fewer recent IDs than restaurants exist', () => {
    const restaurants = [makeRestaurant('a'), makeRestaurant('b'), makeRestaurant('c')];
    const recentIds = ['a'];
    const results = new Set();
    for (let i = 0; i < 30; i++) {
      results.add(selectRestaurant(restaurants, recentIds, true).selected.id);
    }
    expect(results.has('b') || results.has('c')).toBe(true);
    expect(results.has('a')).toBe(false);
  });

  test('handles duplicate IDs in recent list correctly', () => {
    const restaurants = [makeRestaurant('a'), makeRestaurant('b'), makeRestaurant('c')];
    const recentIds = ['a', 'a', 'b', 'b'];
    const results = new Set();
    for (let i = 0; i < 30; i++) {
      results.add(selectRestaurant(restaurants, recentIds, true).selected.id);
    }
    expect(results.has('c')).toBe(true);
    expect(results.has('a')).toBe(false);
    expect(results.has('b')).toBe(false);
  });

  test('returns only active restaurants', () => {
    const restaurants = [makeRestaurant('a', false), makeRestaurant('b', true), makeRestaurant('c', false)];
    for (let i = 0; i < 20; i++) {
      const result = selectRestaurant(restaurants, [], true);
      expect(result.selected.id).toBe('b');
    }
  });

  test('excludes skip_ids from selection (temp disable)', () => {
    const restaurants = [makeRestaurant('a'), makeRestaurant('b'), makeRestaurant('c')];
    for (let i = 0; i < 30; i++) {
      const result = selectRestaurant(restaurants, [], false, ['a', 'b']);
      expect(result.selected.id).toBe('c');
    }
  });

  test('falls back to full active list when all are in skip_ids', () => {
    const restaurants = [makeRestaurant('a'), makeRestaurant('b')];
    const result = selectRestaurant(restaurants, [], false, ['a', 'b']);
    expect(result.selected).not.toBeNull();
    expect(['a', 'b']).toContain(result.selected.id);
  });

  test('skip_ids clears after being passed (stateless)', () => {
    const restaurants = [makeRestaurant('a'), makeRestaurant('b'), makeRestaurant('c')];
    const resultWith = selectRestaurant(restaurants, [], false, ['a']);
    expect(['b', 'c']).toContain(resultWith.selected.id);
    const resultWithout = selectRestaurant(restaurants, [], false, []);
    expect(['a', 'b', 'c']).toContain(resultWithout.selected.id);
  });
});
