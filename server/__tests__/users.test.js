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

const makeProfile = (overrides = {}) => ({
  id: UUID,
  first_name: 'Jane',
  last_name: 'Doe',
  role: 'guest',
  created_at: new Date().toISOString(),
  ...overrides,
});

describe('POST /api/users/register', () => {
  it('creates a new user profile with only first and last name', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [makeProfile()] });

    const res = await request(app)
      .post('/api/users/register')
      .send({ firstName: 'Jane', lastName: 'Doe' });

    expect(res.status).toBe(201);
    expect(res.body.first_name).toBe('Jane');
    expect(res.body.last_name).toBe('Doe');
    expect(res.body.id).toBe(UUID);
    expect(res.body).not.toHaveProperty('password');
  });

  it('does not require a password to register', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [makeProfile()] });

    const res = await request(app)
      .post('/api/users/register')
      .send({ firstName: 'Jane', lastName: 'Doe' });

    expect(res.status).toBe(201);
  });

  it('returns 409 when profile already exists', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: UUID }] });

    const res = await request(app)
      .post('/api/users/register')
      .send({ firstName: 'Jane', lastName: 'Doe' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('returns 400 when first name missing', async () => {
    const res = await request(app)
      .post('/api/users/register')
      .send({ firstName: '', lastName: 'Doe' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when last name missing', async () => {
    const res = await request(app)
      .post('/api/users/register')
      .send({ firstName: 'Jane', lastName: '' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when body is empty', async () => {
    const res = await request(app)
      .post('/api/users/register')
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('POST /api/users/login', () => {
  it('returns user profile without a password check', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [makeProfile()] });

    const res = await request(app)
      .post('/api/users/login')
      .send({ firstName: 'Jane', lastName: 'Doe' });

    expect(res.status).toBe(200);
    expect(res.body.first_name).toBe('Jane');
    expect(res.body.last_name).toBe('Doe');
    expect(res.body).not.toHaveProperty('password');
  });

  it('logs in without sending a password', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [makeProfile()] });

    const res = await request(app)
      .post('/api/users/login')
      .send({ firstName: 'Jane', lastName: 'Doe' });

    expect(res.status).toBe(200);
  });

  it('returns 404 when profile not found', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/users/login')
      .send({ firstName: 'Unknown', lastName: 'Person' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no profile found/i);
  });

  it('returns 400 when first name missing', async () => {
    const res = await request(app)
      .post('/api/users/login')
      .send({ firstName: '', lastName: 'Doe' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when last name missing', async () => {
    const res = await request(app)
      .post('/api/users/login')
      .send({ firstName: 'Jane' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/users/all', () => {
  it('returns list of all profiles without password fields', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        { id: UUID, first_name: 'Jane', last_name: 'Doe', role: 'guest' },
        { id: '22222222-2222-2222-2222-222222222222', first_name: 'John', last_name: 'Smith', role: 'admin' },
      ],
    });

    const res = await request(app).get('/api/users/all');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].first_name).toBe('Jane');
    expect(res.body[1].first_name).toBe('John');
    expect(res.body[0]).not.toHaveProperty('password');
    expect(res.body[0]).not.toHaveProperty('has_password');
  });

  it('returns empty array when no profiles exist', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/users/all');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /api/users/count', () => {
  it('returns total user count', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ total: 5 }] });

    const res = await request(app).get('/api/users/count');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(5);
  });

  it('returns zero when no profiles exist', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ total: 0 }] });

    const res = await request(app).get('/api/users/count');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });
});

describe('Removed password routes', () => {
  it('POST /api/users/set-password returns 404', async () => {
    const res = await request(app)
      .post('/api/users/set-password')
      .send({ userId: UUID, password: 'test' });

    expect(res.status).toBe(404);
  });

  it('POST /api/users/change-user-password returns 404', async () => {
    const res = await request(app)
      .post('/api/users/change-user-password')
      .send({ userId: UUID, currentPassword: 'old', newPassword: 'new1' });

    expect(res.status).toBe(404);
  });

  it('POST /api/users/:id/admin-reset-password returns 404', async () => {
    const res = await request(app)
      .post(`/api/users/${UUID}/admin-reset-password`)
      .send({ adminPassword: 'iloveboba', newPassword: 'new1' });

    expect(res.status).toBe(404);
  });
});
