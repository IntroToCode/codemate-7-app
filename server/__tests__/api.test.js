const request = require('supertest');

const mockPool = {
  query: jest.fn(),
  connect: jest.fn((cb) => cb(null, { release: jest.fn() }, jest.fn())),
};

jest.mock('../db/pool', () => mockPool);
jest.mock('../db/migrate', () => jest.fn().mockResolvedValue());

const app = require('../server');

beforeEach(() => {
  jest.clearAllMocks();
  mockPool.connect.mockImplementation((cb) => cb(null, { release: jest.fn() }, jest.fn()));
});

const UUID = '11111111-1111-1111-1111-111111111111';
const UUID2 = '22222222-2222-2222-2222-222222222222';

const makeRestaurant = (overrides = {}) => ({
  id: UUID,
  name: 'Test Burgers',
  cuisine: 'American',
  price_range: 2,
  address: '123 Test St',
  created_by: 'Alice',
  active: true,
  created_at: new Date().toISOString(),
  tags: [],
  avg_rating: null,
  rating_count: 0,
  ...overrides,
});

describe('GET /api/restaurants', () => {
  test('returns list of restaurants', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [makeRestaurant()] });
    const res = await request(app).get('/api/restaurants');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].name).toBe('Test Burgers');
  });
});

describe('POST /api/restaurants', () => {
  test('creates a restaurant and returns 201', async () => {
    const newR = makeRestaurant();
    mockPool.query.mockResolvedValueOnce({ rows: [newR] });
    const res = await request(app)
      .post('/api/restaurants')
      .send({ name: 'Test Burgers', cuisine: 'American', created_by: 'Alice' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Test Burgers');
  });

  test('returns 400 if name is missing', async () => {
    const res = await request(app).post('/api/restaurants').send({ created_by: 'Alice' });
    expect(res.status).toBe(400);
  });

  test('returns 400 if created_by is missing', async () => {
    const res = await request(app).post('/api/restaurants').send({ name: 'Tacos' });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/restaurants/:id', () => {
  test('updates a restaurant', async () => {
    const updated = makeRestaurant({ name: 'Updated Name' });
    mockPool.query.mockResolvedValueOnce({ rows: [updated] });
    const res = await request(app)
      .put(`/api/restaurants/${UUID}`)
      .send({ name: 'Updated Name' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Name');
  });

  test('returns 404 if restaurant not found', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).put(`/api/restaurants/${UUID}`).send({ name: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/restaurants/:id/toggle', () => {
  test('toggles active status', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [makeRestaurant({ active: false })] });
    const res = await request(app).patch(`/api/restaurants/${UUID}/toggle`);
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
  });

  test('returns 404 if not found', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).patch(`/api/restaurants/${UUID}/toggle`);
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/restaurants/:id', () => {
  test('deletes a restaurant', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: UUID }] });
    const res = await request(app).delete(`/api/restaurants/${UUID}`);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(UUID);
  });

  test('returns 404 if not found', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).delete(`/api/restaurants/${UUID}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/restaurants/autofill', () => {
  test('returns autofill data for a known restaurant', async () => {
    const res = await request(app).get('/api/restaurants/autofill?name=chipotle');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('cuisine');
    expect(res.body).toHaveProperty('price_range');
    expect(res.body).toHaveProperty('address');
    expect(res.body.cuisine).toBe('Mexican');
  });

  test('returns 400 if name query param is missing', async () => {
    const res = await request(app).get('/api/restaurants/autofill');
    expect(res.status).toBe(400);
  });

  test('returns default values for unknown restaurant', async () => {
    const res = await request(app).get('/api/restaurants/autofill?name=unknownxyz123');
    expect(res.status).toBe(200);
    expect(res.body.cuisine).toBe('');
    expect(res.body.price_range).toBe(2);
  });
});

describe('POST /api/spins', () => {
  test('creates a spin and returns 201', async () => {
    const restaurant = makeRestaurant();
    mockPool.query
      .mockResolvedValueOnce({ rows: [restaurant] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: UUID2, restaurant_id: UUID, spun_by: 'Bob', is_vetoed: false, created_at: new Date().toISOString() }] });
    const res = await request(app).post('/api/spins').send({ spun_by: 'Bob' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('spin');
    expect(res.body).toHaveProperty('restaurant');
    expect(res.body.spin.spun_by).toBe('Bob');
  });

  test('excludes skip_ids from the spin when provided', async () => {
    const restaurantA = makeRestaurant({ id: 'aaaa', name: 'Restaurant A' });
    const restaurantB = makeRestaurant({ id: 'bbbb', name: 'Restaurant B' });
    mockPool.query
      .mockResolvedValueOnce({ rows: [restaurantA, restaurantB] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: UUID2, restaurant_id: 'bbbb', spun_by: 'Bob', is_vetoed: false, created_at: new Date().toISOString() }] });

    const res = await request(app)
      .post('/api/spins')
      .send({ spun_by: 'Bob', skip_ids: ['aaaa'] });

    expect(res.status).toBe(201);
    expect(res.body.restaurant.id).toBe('bbbb');
  });

  test('returns 400 if spun_by is missing', async () => {
    const res = await request(app).post('/api/spins').send({});
    expect(res.status).toBe(400);
  });

  test('returns 422 when no eligible restaurants', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/spins').send({ spun_by: 'Bob' });
    expect(res.status).toBe(422);
  });
});

describe('GET /api/spins', () => {
  test('returns spin history', async () => {
    const spin = {
      id: UUID2,
      restaurant_id: UUID,
      restaurant_name: 'Test Burgers',
      spun_by: 'Bob',
      is_vetoed: false,
      created_at: new Date().toISOString(),
    };
    mockPool.query.mockResolvedValueOnce({ rows: [spin] });
    const res = await request(app).get('/api/spins');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].spun_by).toBe('Bob');
  });
});

describe('POST /api/spins/:id/veto', () => {
  test('vetoes a spin and returns a new spin', async () => {
    const restaurant = makeRestaurant();
    const newSpin = { id: UUID2, restaurant_id: UUID, spun_by: 'Bob', is_vetoed: false, created_at: new Date().toISOString() };
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: UUID, is_vetoed: true }] })
      .mockResolvedValueOnce({ rows: [restaurant] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [newSpin] });
    const res = await request(app).post(`/api/spins/${UUID}/veto`).send({ spun_by: 'Bob' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('spin');
    expect(res.body).toHaveProperty('restaurant');
  });

  test('returns 404 if spin not found', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post(`/api/spins/${UUID}/veto`).send({ spun_by: 'Bob' });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/tags', () => {
  test('adds a tag to a restaurant', async () => {
    const tag = { id: UUID, restaurant_id: UUID2, label: 'Vegan', created_at: new Date().toISOString() };
    mockPool.query.mockResolvedValueOnce({ rows: [tag] });
    const res = await request(app)
      .post('/api/tags')
      .send({ restaurant_id: UUID2, label: 'Vegan' });
    expect(res.status).toBe(201);
    expect(res.body.label).toBe('Vegan');
  });

  test('returns 400 if restaurant_id or label is missing', async () => {
    const res = await request(app).post('/api/tags').send({ label: 'Vegan' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/tags/:id', () => {
  test('deletes a tag', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: UUID }] });
    const res = await request(app).delete(`/api/tags/${UUID}`);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(UUID);
  });

  test('returns 404 if tag not found', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).delete(`/api/tags/${UUID}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/ratings', () => {
  test('creates a rating', async () => {
    const rating = { id: UUID, restaurant_id: UUID2, rated_by: 'Alice', score: 4, created_at: new Date().toISOString() };
    mockPool.query.mockResolvedValueOnce({ rows: [rating] });
    const res = await request(app)
      .post('/api/ratings')
      .send({ restaurant_id: UUID2, rated_by: 'Alice', score: 4 });
    expect(res.status).toBe(201);
    expect(res.body.score).toBe(4);
    expect(res.body.rated_by).toBe('Alice');
  });

  test('upserts rating when same user rates again', async () => {
    const updated = { id: UUID, restaurant_id: UUID2, rated_by: 'Alice', score: 5, created_at: new Date().toISOString() };
    mockPool.query.mockResolvedValueOnce({ rows: [updated] });
    const res = await request(app)
      .post('/api/ratings')
      .send({ restaurant_id: UUID2, rated_by: 'Alice', score: 5 });
    expect(res.status).toBe(201);
    expect(res.body.score).toBe(5);
  });

  test('returns 400 if score is out of range', async () => {
    const res = await request(app)
      .post('/api/ratings')
      .send({ restaurant_id: UUID2, rated_by: 'Alice', score: 6 });
    expect(res.status).toBe(400);
  });

  test('returns 400 if fields are missing', async () => {
    const res = await request(app)
      .post('/api/ratings')
      .send({ restaurant_id: UUID2, rated_by: 'Alice' });
    expect(res.status).toBe(400);
  });

  test('restaurant GET reflects updated avg_rating after upsert', async () => {
    const ratingV1 = { id: UUID, restaurant_id: UUID2, rated_by: 'Alice', score: 2, created_at: new Date().toISOString() };
    const ratingV2 = { id: UUID, restaurant_id: UUID2, rated_by: 'Alice', score: 4, created_at: new Date().toISOString() };
    const restaurantWithUpdatedRating = makeRestaurant({ id: UUID2, avg_rating: '4.0', rating_count: 1 });

    mockPool.query.mockResolvedValueOnce({ rows: [ratingV1] });
    const post1 = await request(app)
      .post('/api/ratings')
      .send({ restaurant_id: UUID2, rated_by: 'Alice', score: 2 });
    expect(post1.status).toBe(201);
    expect(post1.body.score).toBe(2);

    mockPool.query.mockResolvedValueOnce({ rows: [ratingV2] });
    const post2 = await request(app)
      .post('/api/ratings')
      .send({ restaurant_id: UUID2, rated_by: 'Alice', score: 4 });
    expect(post2.status).toBe(201);
    expect(post2.body.score).toBe(4);

    mockPool.query.mockResolvedValueOnce({ rows: [restaurantWithUpdatedRating] });
    const getRes = await request(app).get('/api/restaurants');
    expect(getRes.status).toBe(200);
    const restaurant = getRes.body.find((r) => r.id === UUID2);
    expect(restaurant).toBeDefined();
    expect(parseFloat(restaurant.avg_rating)).toBe(4.0);
    expect(restaurant.rating_count).toBe(1);
  });
});
