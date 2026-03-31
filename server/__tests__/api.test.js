const request = require('supertest');

const mockPool = {
  query: jest.fn(),
  connect: jest.fn((cb) => cb(null, { release: jest.fn() }, jest.fn())),
};

jest.mock('../db/pool', () => mockPool);
jest.mock('../db/migrate', () => jest.fn().mockResolvedValue());
jest.mock('../lib/logActivity', () => jest.fn().mockResolvedValue(undefined));

const app = require('../server');

beforeEach(() => {
  jest.clearAllMocks();
  mockPool.query.mockReset();
  mockPool.connect.mockReset();
  mockPool.connect.mockImplementation((cb) => cb(null, { release: jest.fn() }, jest.fn()));
});

const UUID = '11111111-1111-1111-1111-111111111111';
const UUID2 = '22222222-2222-2222-2222-222222222222';

const makeProfile = (overrides = {}) => ({
  id: UUID2,
  role: 'guest',
  spin_counter_reset_at: null,
  ...overrides,
});

function mockSpinPrechecks({ profile = makeProfile(), limit = '2', used = 0 } = {}) {
  mockPool.query
    .mockResolvedValueOnce({ rows: [profile] })
    .mockResolvedValueOnce({ rows: [{ value: limit }] })
    .mockResolvedValueOnce({ rows: [{ count: used }] });
}

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
  test('updates a restaurant as creator', async () => {
    const updated = makeRestaurant({ name: 'Updated Name' });
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ created_by: 'Alice Smith' }] })
      .mockResolvedValueOnce({ rows: [{ first_name: 'Alice', last_name: 'Smith' }] })
      .mockResolvedValueOnce({ rows: [updated] });
    const res = await request(app)
      .put(`/api/restaurants/${UUID}`)
      .set('X-User-Id', UUID2)
      .send({ name: 'Updated Name' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Name');
  });

  test('returns 401 if no user id', async () => {
    const res = await request(app).put(`/api/restaurants/${UUID}`).send({ name: 'X' });
    expect(res.status).toBe(401);
  });

  test('returns 403 if not creator', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ created_by: 'Bob Jones' }] })
      .mockResolvedValueOnce({ rows: [{ first_name: 'Alice', last_name: 'Smith' }] });
    const res = await request(app)
      .put(`/api/restaurants/${UUID}`)
      .set('X-User-Id', UUID2)
      .send({ name: 'X' });
    expect(res.status).toBe(403);
  });

  test('returns 404 if restaurant not found', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .put(`/api/restaurants/${UUID}`)
      .set('X-User-Id', UUID2)
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/restaurants/:id/toggle', () => {
  test('toggles active status as creator', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ created_by: 'Alice Smith' }] })
      .mockResolvedValueOnce({ rows: [{ first_name: 'Alice', last_name: 'Smith' }] })
      .mockResolvedValueOnce({ rows: [makeRestaurant({ active: false })] });
    const res = await request(app)
      .patch(`/api/restaurants/${UUID}/toggle`)
      .set('X-User-Id', UUID2);
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
  });

  test('returns 401 if no user id provided', async () => {
    const res = await request(app).patch(`/api/restaurants/${UUID}/toggle`);
    expect(res.status).toBe(401);
  });

  test('returns 403 if not creator', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ created_by: 'Bob Jones' }] })
      .mockResolvedValueOnce({ rows: [{ first_name: 'Alice', last_name: 'Smith' }] });
    const res = await request(app)
      .patch(`/api/restaurants/${UUID}/toggle`)
      .set('X-User-Id', UUID2);
    expect(res.status).toBe(403);
  });

  test('returns 404 if not found', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .patch(`/api/restaurants/${UUID}/toggle`)
      .set('X-User-Id', UUID2);
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/restaurants/:id', () => {
  test('deletes a restaurant as creator', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: UUID, created_by: 'Alice Smith' }] })
      .mockResolvedValueOnce({ rows: [{ first_name: 'Alice', last_name: 'Smith' }] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .delete(`/api/restaurants/${UUID}`)
      .set('X-User-Id', UUID2);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(UUID);
  });

  test('returns 401 if no user id', async () => {
    const res = await request(app).delete(`/api/restaurants/${UUID}`);
    expect(res.status).toBe(401);
  });

  test('returns 403 if not creator', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: UUID, created_by: 'Bob Jones' }] })
      .mockResolvedValueOnce({ rows: [{ first_name: 'Alice', last_name: 'Smith' }] });
    const res = await request(app)
      .delete(`/api/restaurants/${UUID}`)
      .set('X-User-Id', UUID2);
    expect(res.status).toBe(403);
  });

  test('returns 404 if not found', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .delete(`/api/restaurants/${UUID}`)
      .set('X-User-Id', UUID2);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/spins', () => {
  test('creates a spin and returns 201', async () => {
    const restaurant = makeRestaurant();
    mockSpinPrechecks();
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
    mockSpinPrechecks();
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

  test('returns 429 when the user has reached the spin limit', async () => {
    mockSpinPrechecks({ limit: '2', used: 2 });
    mockPool.query.mockResolvedValueOnce({ rows: [{ created_at: new Date() }] });

    const res = await request(app).post('/api/spins').send({ spun_by: 'Bob' });

    expect(res.status).toBe(429);
    expect(res.body.limit).toBe(2);
    expect(res.body.used).toBe(2);
    expect(typeof res.body.resetTime).toBe('string');
    expect(res.body.retryAfterSeconds).toBeGreaterThanOrEqual(0);
  });

  test('returns 422 when no eligible restaurants', async () => {
    mockSpinPrechecks();
    mockPool.query
      .mockResolvedValueOnce({ rows: [makeRestaurant()] })
      .mockResolvedValueOnce({ rows: [{ restaurant_id: UUID }] })
      ;
    const res = await request(app).post('/api/spins').send({ spun_by: 'Bob' });
    expect(res.status).toBe(422);
  });

  test('respects the recent non-vetoed 7 day exclusion', async () => {
    const restaurantA = makeRestaurant({ id: 'aaaa', name: 'Restaurant A' });
    const restaurantB = makeRestaurant({ id: 'bbbb', name: 'Restaurant B' });
    mockSpinPrechecks();
    mockPool.query
      .mockResolvedValueOnce({ rows: [restaurantA, restaurantB] })
      .mockResolvedValueOnce({ rows: [{ restaurant_id: 'aaaa' }] })
      .mockResolvedValueOnce({ rows: [{ id: UUID2, restaurant_id: 'bbbb', spun_by: 'Bob', is_vetoed: false, created_at: new Date().toISOString() }] });
    const res = await request(app).post('/api/spins').send({ spun_by: 'Bob' });
    expect(res.status).toBe(201);
    expect(res.body.restaurant.id).toBe('bbbb');
  });
});

describe('GET /api/spins/recent-ids', () => {
  test('returns unique recent non-vetoed restaurant ids', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        { restaurant_id: UUID },
        { restaurant_id: UUID },
        { restaurant_id: 'bbbb' },
        { restaurant_id: null },
      ],
    });
    const res = await request(app).get('/api/spins/recent-ids');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ restaurant_ids: [UUID, 'bbbb'] });
  });

  test('accepts a custom days window', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/spins/recent-ids?days=3');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ restaurant_ids: [] });
  });

  test('returns an empty array when there are no recent spins', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/spins/recent-ids');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ restaurant_ids: [] });
  });
});

describe('GET /api/spins/remaining', () => {
  test('returns 400 when user_name is missing', async () => {
    const res = await request(app).get('/api/spins/remaining');
    expect(res.status).toBe(400);
  });

  test('returns 404 when the user does not exist', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/spins/remaining?user_name=Missing%20User');

    expect(res.status).toBe(404);
  });

  test('returns unlimited info for users with unlimited spin limits', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [makeProfile({ role: 'admin' })] })
      .mockResolvedValueOnce({ rows: [{ value: '-1' }] });

    const res = await request(app).get('/api/spins/remaining?user_name=Bob');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ remaining: -1, limit: -1, used: 0, unlimited: true });
  });

  test('returns remaining count and reset time when the limit has been reached', async () => {
    const firstSpinAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    mockPool.query
      .mockResolvedValueOnce({ rows: [makeProfile()] })
      .mockResolvedValueOnce({ rows: [{ value: '2' }] })
      .mockResolvedValueOnce({ rows: [{ count: 2 }] })
      .mockResolvedValueOnce({ rows: [{ created_at: firstSpinAt }] });

    const res = await request(app).get('/api/spins/remaining?user_name=Bob');

    expect(res.status).toBe(200);
    expect(res.body.remaining).toBe(0);
    expect(res.body.limit).toBe(2);
    expect(res.body.used).toBe(2);
    expect(res.body.unlimited).toBe(false);
    expect(res.body.resetTime).toBe(new Date(firstSpinAt.getTime() + 24 * 60 * 60 * 1000).toISOString());
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

  test('vetoed restaurant is excluded from the immediate re-spin', async () => {
    const vetoedId = 'aaaa';
    const otherId = 'bbbb';
    const vetoedRestaurant = makeRestaurant({ id: vetoedId, name: 'Vetoed Place' });
    const otherRestaurant = makeRestaurant({ id: otherId, name: 'Other Place' });
    const newSpin = { id: UUID2, restaurant_id: otherId, spun_by: 'Bob', is_vetoed: false, created_at: new Date().toISOString() };

    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: UUID, restaurant_id: vetoedId, is_vetoed: true }] })
      .mockResolvedValueOnce({ rows: [vetoedRestaurant, otherRestaurant] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [newSpin] });

    const res = await request(app).post(`/api/spins/${UUID}/veto`).send({ spun_by: 'Bob' });
    expect(res.status).toBe(201);
    expect(res.body.restaurant.id).toBe(otherId);
    expect(res.body.restaurant.id).not.toBe(vetoedId);
  });

  test('returns 422 after veto when all remaining options are excluded by recent spins', async () => {
    const vetoedId = 'aaaa';
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: UUID, restaurant_id: vetoedId, is_vetoed: true }] })
      .mockResolvedValueOnce({ rows: [makeRestaurant({ id: vetoedId }), makeRestaurant({ id: 'bbbb' })] })
      .mockResolvedValueOnce({ rows: [{ restaurant_id: 'bbbb' }] });
    const res = await request(app).post(`/api/spins/${UUID}/veto`).send({ spun_by: 'Bob' });
    expect(res.status).toBe(422);
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
