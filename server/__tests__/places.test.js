const {
  validateZipCode,
  buildGeocodingUrl,
  buildNearbySearchUrl,
  mapPriceLevel,
  formatPlaceResult,
  geocodeZipCode,
  searchNearbyRestaurants,
  searchByZipCode,
} = require('../lib/places');

describe('validateZipCode', () => {
  test('accepts valid 5-digit zip code', () => {
    expect(validateZipCode('10001')).toBe(true);
    expect(validateZipCode('90210')).toBe(true);
    expect(validateZipCode('00501')).toBe(true);
  });

  test('accepts zip code with surrounding whitespace', () => {
    expect(validateZipCode(' 10001 ')).toBe(true);
  });

  test('rejects zip codes that are not 5 digits', () => {
    expect(validateZipCode('1234')).toBe(false);
    expect(validateZipCode('123456')).toBe(false);
    expect(validateZipCode('abcde')).toBe(false);
    expect(validateZipCode('')).toBe(false);
  });

  test('rejects null and undefined', () => {
    expect(validateZipCode(null)).toBe(false);
    expect(validateZipCode(undefined)).toBe(false);
  });

  test('rejects non-string input', () => {
    expect(validateZipCode(12345)).toBe(false);
  });
});

describe('buildGeocodingUrl', () => {
  test('builds correct geocoding URL', () => {
    const url = buildGeocodingUrl('10001');
    expect(url).toContain('maps.googleapis.com/maps/api/geocode/json');
    expect(url).toContain('address=10001');
    expect(url).toContain('key=');
  });
});

describe('buildNearbySearchUrl', () => {

  test('builds URL without keyword', () => {
    const url = buildNearbySearchUrl(40.7128, -74.006, '');
    expect(url).toContain('nearbysearch/json');
    expect(url).toContain('location=40.7128%2C-74.006');
    expect(url).toContain('type=restaurant');
    expect(url).not.toContain('keyword');
  });

  test('builds URL with keyword', () => {
    const url = buildNearbySearchUrl(40.7128, -74.006, 'sushi');
    expect(url).toContain('keyword=sushi');
  });

  test('trims keyword whitespace', () => {
    const url = buildNearbySearchUrl(40.7128, -74.006, '  pizza  ');
    expect(url).toContain('keyword=pizza');
  });
});

describe('mapPriceLevel', () => {
  test('maps Google price levels correctly', () => {
    expect(mapPriceLevel(0)).toBe(1);
    expect(mapPriceLevel(1)).toBe(1);
    expect(mapPriceLevel(2)).toBe(2);
    expect(mapPriceLevel(3)).toBe(3);
    expect(mapPriceLevel(4)).toBe(4);
  });

  test('clamps values above 4', () => {
    expect(mapPriceLevel(5)).toBe(4);
  });

  test('returns null for undefined/null', () => {
    expect(mapPriceLevel(undefined)).toBe(null);
    expect(mapPriceLevel(null)).toBe(null);
  });
});

describe('formatPlaceResult', () => {
  test('formats a place result correctly', () => {
    const place = {
      place_id: 'ChIJ123',
      name: 'Test Restaurant',
      vicinity: '123 Main St',
      types: ['restaurant', 'food', 'bar'],
      price_level: 2,
      rating: 4.5,
    };
    const result = formatPlaceResult(place);
    expect(result).toEqual({
      place_id: 'ChIJ123',
      name: 'Test Restaurant',
      address: '123 Main St',
      cuisine: 'bar',
      price_range: 2,
      rating: 4.5,
    });
  });

  test('handles missing fields gracefully', () => {
    const place = {
      place_id: 'ChIJ456',
      name: 'Minimal Place',
      types: ['restaurant', 'food'],
    };
    const result = formatPlaceResult(place);
    expect(result.address).toBe('');
    expect(result.cuisine).toBe('');
    expect(result.price_range).toBe(null);
    expect(result.rating).toBe(null);
  });
});

describe('geocodeZipCode', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('returns lat/lng on successful geocode', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({
        status: 'OK',
        results: [{ geometry: { location: { lat: 40.7128, lng: -74.006 } } }],
      }),
    });
    const result = await geocodeZipCode('10001');
    expect(result).toEqual({ lat: 40.7128, lng: -74.006 });
  });

  test('returns null on ZERO_RESULTS', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 'ZERO_RESULTS', results: [] }),
    });
    const result = await geocodeZipCode('00000');
    expect(result).toBeNull();
  });

  test('returns null on non-OK status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 'REQUEST_DENIED', results: [] }),
    });
    const result = await geocodeZipCode('10001');
    expect(result).toBeNull();
  });
});

describe('searchNearbyRestaurants', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('returns formatted results on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({
        status: 'OK',
        results: [
          { place_id: 'ChIJ1', name: 'Pizza Place', vicinity: '1 Main St', types: ['restaurant', 'food'], price_level: 1, rating: 4.2 },
        ],
      }),
    });
    const results = await searchNearbyRestaurants(40.7, -74.0, '');
    expect(results).toHaveLength(1);
    expect(results[0].place_id).toBe('ChIJ1');
    expect(results[0].name).toBe('Pizza Place');
  });

  test('returns empty array on ZERO_RESULTS', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 'ZERO_RESULTS', results: [] }),
    });
    const results = await searchNearbyRestaurants(40.7, -74.0, 'xyz');
    expect(results).toEqual([]);
  });

  test('throws on error status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 'REQUEST_DENIED' }),
    });
    await expect(searchNearbyRestaurants(40.7, -74.0, '')).rejects.toThrow('Google Places API error');
  });
});

describe('searchByZipCode', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('throws on invalid zip code', async () => {
    await expect(searchByZipCode('abc', '')).rejects.toThrow('Invalid zip code');
  });

  test('throws when geocoding fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 'ZERO_RESULTS', results: [] }),
    });
    await expect(searchByZipCode('00000', '')).rejects.toThrow('Could not find location');
  });

  test('returns results for valid zip', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({
          status: 'OK',
          results: [{ geometry: { location: { lat: 40.7, lng: -74.0 } } }],
        }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({
          status: 'OK',
          results: [{ place_id: 'ChIJ1', name: 'Test', vicinity: '1 Main', types: ['restaurant'] }],
        }),
      });
    const results = await searchByZipCode('10001', '');
    expect(results).toHaveLength(1);
  });
});
