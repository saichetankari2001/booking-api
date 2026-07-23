import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { resetDb } from './helpers/resetDb';

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Route table smoke test', () => {
  it('every documented route is reachable (not 404)', async () => {
    const checks = [
      () => request(app).get('/health'),
      () => request(app).post('/auth/login').send({}),
      () => request(app).get('/slots'),
      () => request(app).get('/tables/available'),
      () => request(app).post('/bookings').send({}),
      () => request(app).get('/admin/tables'),
      () => request(app).get('/admin/slots'),
      () => request(app).get('/admin/bookings'),
    ];

    for (const run of checks) {
      const res = await run();
      expect(res.status).not.toBe(404);
    }
  });
});
