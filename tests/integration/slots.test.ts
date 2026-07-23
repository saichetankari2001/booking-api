import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { resetDb } from './helpers/resetDb';
import { getAuthToken } from './helpers/getAuthToken';

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Slots', () => {
  it('GET /slots returns only active slots, no auth required', async () => {
    await prisma.timeSlot.create({
      data: { label: 'Lunch', startTime: '12:00', durationMinutes: 90, isActive: true },
    });
    await prisma.timeSlot.create({
      data: { label: 'Old', startTime: '09:00', durationMinutes: 60, isActive: false },
    });

    const res = await request(app).get('/slots');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].label).toBe('Lunch');
  });

  it('rejects admin slot requests without a token', async () => {
    const res = await request(app).get('/admin/slots');
    expect(res.status).toBe(401);
  });

  it('admin can create, update, and delete a slot', async () => {
    const token = await getAuthToken(app);

    const createRes = await request(app)
      .post('/admin/slots')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Brunch', startTime: '10:00', durationMinutes: 60 });
    expect(createRes.status).toBe(201);
    const slotId = createRes.body.id;

    const updateRes = await request(app)
      .patch(`/admin/slots/${slotId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.isActive).toBe(false);

    const deleteRes = await request(app)
      .delete(`/admin/slots/${slotId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(204);
  });
});
