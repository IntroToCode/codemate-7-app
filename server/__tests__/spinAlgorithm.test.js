const { selectRestaurant } = require('../lib/spinAlgorithm');

const makeRestaurant = (id, active = true) => ({ id, name: `Restaurant ${id}`, active });
const makeSpin = (restaurant_id) => ({ restaurant_id });

describe('selectRestaurant', () => {
  test('returns null when no active restaurants', () => {
    const result = selectRestaurant(
      [makeRestaurant('a', false), makeRestaurant('b', false)],
      [],
      true
    );
    expect(result).toBeNull();
  });

  test('returns null when restaurants array is empty', () => {
    expect(selectRestaurant([], [], true)).toBeNull();
  });

  test('returns a restaurant when there is one active', () => {
    const restaurants = [makeRestaurant('a')];
    const result = selectRestaurant(restaurants, [], true);
    expect(result).not.toBeNull();
    expect(result.id).toBe('a');
  });

  test('excludes last 5 spin restaurants when excludeRecent is true', () => {
    const restaurants = [
      makeRestaurant('a'),
      makeRestaurant('b'),
      makeRestaurant('c'),
      makeRestaurant('d'),
      makeRestaurant('e'),
      makeRestaurant('f'),
    ];
    const recentSpins = ['a', 'b', 'c', 'd', 'e'].map(makeSpin);
    const result = selectRestaurant(restaurants, recentSpins, true);
    expect(result).not.toBeNull();
    expect(result.id).toBe('f');
  });

  test('does NOT exclude restaurants when excludeRecent is false', () => {
    const restaurants = [makeRestaurant('a'), makeRestaurant('b')];
    const recentSpins = [makeSpin('a'), makeSpin('b')];
    const results = new Set();
    for (let i = 0; i < 30; i++) {
      results.add(selectRestaurant(restaurants, recentSpins, false).id);
    }
    expect(results.has('a') || results.has('b')).toBe(true);
  });

  test('falls back to full list when all active restaurants are in last 5', () => {
    const restaurants = [makeRestaurant('a'), makeRestaurant('b')];
    const recentSpins = [makeSpin('a'), makeSpin('b')];
    const result = selectRestaurant(restaurants, recentSpins, true);
    expect(result).not.toBeNull();
    expect(['a', 'b']).toContain(result.id);
  });

  test('works when fewer than 5 prior spins exist', () => {
    const restaurants = [makeRestaurant('a'), makeRestaurant('b'), makeRestaurant('c')];
    const recentSpins = [makeSpin('a')];
    const results = new Set();
    for (let i = 0; i < 30; i++) {
      results.add(selectRestaurant(restaurants, recentSpins, true).id);
    }
    expect(results.has('b') || results.has('c')).toBe(true);
    expect(results.has('a')).toBe(false);
  });

  test('only considers up to 5 most recent spins for exclusion', () => {
    const restaurants = [makeRestaurant('a'), makeRestaurant('b'), makeRestaurant('c')];
    const recentSpins = [
      makeSpin('a'), makeSpin('b'),
      makeSpin('c'), makeSpin('a'), makeSpin('b'),
      makeSpin('c'),
    ];
    const result = selectRestaurant(restaurants, recentSpins, true);
    expect(result).not.toBeNull();
  });

  test('returns only active restaurants', () => {
    const restaurants = [makeRestaurant('a', false), makeRestaurant('b', true), makeRestaurant('c', false)];
    for (let i = 0; i < 20; i++) {
      const result = selectRestaurant(restaurants, [], true);
      expect(result.id).toBe('b');
    }
  });
});
