const request = require('supertest');

const mockPool = {
  query: jest.fn(),
  connect: jest.fn((cb) => cb(null, { release: jest.fn() }, jest.fn())),
};

jest.mock('../db/pool', () => mockPool);
jest.mock('../db/migrate', () => jest.fn().mockResolvedValue());

jest.mock('../lib/places', () => ({
  validateZipCode: jest.fn((zip) => /^\d{5}$/.test((zip || '').trim())),
  searchWithSmartFill: jest.fn(),
}));

const app = require('../server');
const { searchWithSmartFill } = require('../lib/places');

beforeEach(() => {
  jest.clearAllMocks();
  mockPool.connect.mockImplementation((cb) => cb(null, { release: jest.fn() }, jest.fn()));
});

describe('GET /api/restaurants/search', () => {
  test('returns 400 if zip is missing', async () => {
    const res = await request(app).get('/api/restaurants/search');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/zip code/i);
  });

  test('returns 400 if zip is invalid', async () => {
    const res = await request(app).get('/api/restaurants/search?zip=abc');
    expect(res.status).toBe(400);
  });

  test('returns search results with duplicate flags and pagination', async () => {
    const places = [
      { place_id: 'ChIJ_1', name: 'Test Place', address: '123 Main St', cuisine: 'Italian', price_range: 2, rating: 4.0, already_added: false },
      { place_id: 'ChIJ_2', name: 'Existing Place', address: '456 Oak Ave', cuisine: 'Mexican', price_range: 1, rating: 3.5, already_added: true },
    ];
    searchWithSmartFill.mockResolvedValueOnce({
      results: places,
      nextPageToken: 'token123',
    });
    mockPool.query.mockResolvedValueOnce({
      rows: [{ name: 'Existing Place', address: '456 Oak Ave', google_place_id: 'ChIJ_2' }],
    });

    const res = await request(app).get('/api/restaurants/search?zip=10001');
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(2);
    expect(res.body.results[0].already_added).toBe(false);
    expect(res.body.results[1].already_added).toBe(true);
    expect(res.body.nextPageToken).toBe('token123');
  });

  test('passes keyword and page_token to search', async () => {
    searchWithSmartFill.mockResolvedValueOnce({ results: [], nextPageToken: null });
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await request(app).get('/api/restaurants/search?zip=10001&keyword=sushi&page_token=abc123');
    expect(searchWithSmartFill).toHaveBeenCalledWith('10001', 'sushi', 'abc123', [], false);
  });

  test('passes hide_duplicates flag to search', async () => {
    searchWithSmartFill.mockResolvedValueOnce({ results: [], nextPageToken: null });
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await request(app).get('/api/restaurants/search?zip=10001&hide_duplicates=true');
    expect(searchWithSmartFill).toHaveBeenCalledWith('10001', '', null, [], true);
  });

  test('returns 500 on API error', async () => {
    searchWithSmartFill.mockRejectedValueOnce(new Error('Google Places API error: REQUEST_DENIED'));
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/restaurants/search?zip=10001');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Google Places API/);
  });
});

describe('POST /api/restaurants with google_place_id', () => {
  test('stores google_place_id when provided', async () => {
    const newR = {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Google Place',
      cuisine: 'Italian',
      price_range: 2,
      address: '123 Main',
      created_by: 'Alice',
      google_place_id: 'ChIJ_test',
      active: true,
    };
    mockPool.query.mockResolvedValueOnce({ rows: [newR] });

    const res = await request(app)
      .post('/api/restaurants')
      .send({
        name: 'Google Place',
        cuisine: 'Italian',
        price_range: 2,
        address: '123 Main',
        created_by: 'Alice',
        google_place_id: 'ChIJ_test',
      });
    expect(res.status).toBe(201);
    expect(res.body.google_place_id).toBe('ChIJ_test');
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('google_place_id'),
      expect.arrayContaining(['ChIJ_test']),
    );
  });

  test('stores null when google_place_id is not provided', async () => {
    const newR = {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Manual Place',
      cuisine: null,
      price_range: null,
      address: null,
      created_by: 'Alice',
      google_place_id: null,
      active: true,
    };
    mockPool.query.mockResolvedValueOnce({ rows: [newR] });

    const res = await request(app)
      .post('/api/restaurants')
      .send({ name: 'Manual Place', created_by: 'Alice' });
    expect(res.status).toBe(201);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('google_place_id'),
      expect.arrayContaining([null]),
    );
  });
});
