import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { resetDb } from './helpers/resetDb';
import { seedAdmin } from './helpers/seedAdmin';

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Auth flow', () => {
  it('logs in with valid credentials and returns tokens', async () => {
    await seedAdmin('admin@test.com', 'password123');
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@test.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
  });

  it('returns 401 for wrong password', async () => {
    await seedAdmin('admin@test.com', 'password123');
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@test.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('returns 422 for a malformed login body', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(422);
  });

  it('refreshes an access token with a valid refresh token', async () => {
    await seedAdmin('admin@test.com', 'password123');
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@test.com', password: 'password123' });
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it('logs out and then rejects reuse of the same refresh token', async () => {
    await seedAdmin('admin@test.com', 'password123');
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@test.com', password: 'password123' });
    const logoutRes = await request(app)
      .post('/auth/logout')
      .send({ refreshToken: loginRes.body.refreshToken });
    expect(logoutRes.status).toBe(204);
    const refreshRes = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken });
    expect(refreshRes.status).toBe(401);
  });
});
