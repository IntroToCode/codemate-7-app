const request = require('supertest');

jest.mock('../db/pool', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  connect: jest.fn((cb) => cb(null, { release: jest.fn() }, jest.fn())),
}));

jest.mock('../db/migrate', () => jest.fn().mockResolvedValue());

const app = require('../server');

describe('GET /api/health', () => {
  test('returns 200 with status ok when DB responds', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('connected');
  });

  test('returns 500 when DB throws', async () => {
    const pool = require('../db/pool');
    pool.query.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(500);
    expect(res.body.database).toBe('disconnected');
  });
});
