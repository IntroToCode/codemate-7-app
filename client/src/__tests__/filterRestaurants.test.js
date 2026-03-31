import { filterRestaurants } from '../components/rouletteUtils.jsx';

const RESTAURANTS = [
  { id: 1, name: 'Pasta Palace',   cuisine: 'Italian',  price_range: 2 },
  { id: 2, name: 'Burger Barn',    cuisine: 'American', price_range: 1 },
  { id: 3, name: 'Sushi Spot',     cuisine: 'Japanese', price_range: 3 },
  { id: 4, name: 'Taco Town',      cuisine: 'Mexican',  price_range: 1 },
  { id: 5, name: 'Pizza Piazza',   cuisine: 'Italian',  price_range: 1 },
  { id: 6, name: 'Ramen Republic', cuisine: 'Japanese', price_range: 2 },
  { id: 7, name: 'No Cuisine',     cuisine: null,       price_range: 2 },
  { id: 8, name: 'No Price',       cuisine: 'French',   price_range: null },
];

describe('filterRestaurants', () => {
  describe('no filters active', () => {
    test('returns all restaurants when cuisine is empty string and price is null', () => {
      expect(filterRestaurants(RESTAURANTS, '', null)).toHaveLength(RESTAURANTS.length);
    });

    test('returns same array contents (not same reference)', () => {
      const result = filterRestaurants(RESTAURANTS, '', null);
      expect(result).not.toBe(RESTAURANTS);
      result.forEach((r, i) => expect(r).toBe(RESTAURANTS[i]));
    });

    test('handles empty list', () => {
      expect(filterRestaurants([], '', null)).toEqual([]);
    });
  });

  describe('cuisine filter', () => {
    test('filters to only matching cuisine', () => {
      const result = filterRestaurants(RESTAURANTS, 'Italian', null);
      expect(result).toHaveLength(2);
      expect(result.every((r) => r.cuisine === 'Italian')).toBe(true);
    });

    test('is case-insensitive', () => {
      const lower = filterRestaurants(RESTAURANTS, 'japanese', null);
      const upper = filterRestaurants(RESTAURANTS, 'JAPANESE', null);
      expect(lower).toHaveLength(2);
      expect(upper).toHaveLength(2);
    });

    test('returns empty array when no restaurant matches the cuisine', () => {
      expect(filterRestaurants(RESTAURANTS, 'Ethiopian', null)).toHaveLength(0);
    });

    test('excludes restaurants with null cuisine when a cuisine filter is set', () => {
      const result = filterRestaurants(RESTAURANTS, 'Italian', null);
      expect(result.every((r) => r.cuisine !== null)).toBe(true);
    });
  });

  describe('price filter', () => {
    test('filters to $ (price_range 1)', () => {
      const result = filterRestaurants(RESTAURANTS, '', 1);
      expect(result.every((r) => r.price_range === 1)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    test('filters to $$ (price_range 2)', () => {
      const result = filterRestaurants(RESTAURANTS, '', 2);
      expect(result.every((r) => r.price_range === 2)).toBe(true);
    });

    test('filters to $$$ (price_range 3)', () => {
      const result = filterRestaurants(RESTAURANTS, '', 3);
      expect(result.every((r) => r.price_range === 3)).toBe(true);
    });

    test('returns empty array when no restaurant matches the price', () => {
      expect(filterRestaurants(RESTAURANTS, '', 4)).toHaveLength(0);
    });

    test('excludes restaurants with null price_range when a price filter is set', () => {
      const result = filterRestaurants(RESTAURANTS, '', 2);
      expect(result.every((r) => r.price_range !== null)).toBe(true);
    });
  });

  describe('combined cuisine + price filters', () => {
    test('applies both filters together', () => {
      const result = filterRestaurants(RESTAURANTS, 'Italian', 1);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Pizza Piazza');
    });

    test('returns empty array when cuisine matches but price does not', () => {
      expect(filterRestaurants(RESTAURANTS, 'Japanese', 1)).toHaveLength(0);
    });

    test('returns empty array when price matches but cuisine does not', () => {
      expect(filterRestaurants(RESTAURANTS, 'Ethiopian', 1)).toHaveLength(0);
    });

    test('returns empty array when neither filter matches', () => {
      expect(filterRestaurants(RESTAURANTS, 'Ethiopian', 3)).toHaveLength(0);
    });
  });

  describe('does not mutate input', () => {
    test('original array length is unchanged after filtering', () => {
      const original = [...RESTAURANTS];
      filterRestaurants(RESTAURANTS, 'Italian', 1);
      expect(RESTAURANTS).toHaveLength(original.length);
    });
  });
});
