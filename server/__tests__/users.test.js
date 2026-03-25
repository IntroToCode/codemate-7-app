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

const makeUser = (overrides = {}) => ({
  id: UUID,
  first_name: 'John',
  last_name: 'Doe',
  created_at: new Date().toISOString(),
  ...overrides,
});

describe('GET /api/users', () => {
  test('returns list of users', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [makeUser()] });
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].first_name).toBe('John');
    expect(res.body[0].last_name).toBe('Doe');
  });

  test('returns empty array when no users exist', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns 500 on database error', async () => {
    mockPool.query.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(500);
  });
});

describe('POST /api/users', () => {
  test('creates a new user and returns 201', async () => {
    const newUser = makeUser();
    mockPool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [newUser] })
      .mockResolvedValueOnce({ rows: [{ value: 'Existing Admin' }] });

    const res = await request(app)
      .post('/api/users')
      .send({ first_name: 'John', last_name: 'Doe' });
    expect(res.status).toBe(201);
    expect(res.body.first_name).toBe('John');
    expect(res.body.last_name).toBe('Doe');
  });

  test('sets first user as admin when no admin exists', async () => {
    const newUser = makeUser();
    mockPool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [newUser] })
      .mockResolvedValueOnce({ rows: [{ value: '' }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/users')
      .send({ first_name: 'John', last_name: 'Doe' });
    expect(res.status).toBe(201);
    expect(mockPool.query).toHaveBeenCalledWith(
      "UPDATE app_settings SET value = $1 WHERE key = 'admin_username'",
      ['John Doe']
    );
  });

  test('returns 409 when user already exists', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [makeUser()] });

    const res = await request(app)
      .post('/api/users')
      .send({ first_name: 'John', last_name: 'Doe' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/);
  });

  test('returns 400 when first_name is missing', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ last_name: 'Doe' });
    expect(res.status).toBe(400);
  });

  test('returns 400 when last_name is missing', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ first_name: 'John' });
    expect(res.status).toBe(400);
  });

  test('returns 400 when both names are missing', async () => {
    const res = await request(app).post('/api/users').send({});
    expect(res.status).toBe(400);
  });

  test('returns 400 when names are empty strings', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ first_name: '  ', last_name: '' });
    expect(res.status).toBe(400);
  });

  test('trims whitespace from names', async () => {
    const newUser = makeUser({ first_name: 'Jane', last_name: 'Smith' });
    mockPool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [newUser] })
      .mockResolvedValueOnce({ rows: [{ value: 'Existing Admin' }] });

    const res = await request(app)
      .post('/api/users')
      .send({ first_name: '  Jane  ', last_name: '  Smith  ' });
    expect(res.status).toBe(201);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT'),
      ['Jane', 'Smith']
    );
  });

  test('returns 500 on database error', async () => {
    mockPool.query.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app)
      .post('/api/users')
      .send({ first_name: 'John', last_name: 'Doe' });
    expect(res.status).toBe(500);
  });
});
