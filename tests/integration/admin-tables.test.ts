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

describe('Admin table management', () => {
  it('rejects requests without a token', async () => {
    const res = await request(app).get('/admin/tables');
    expect(res.status).toBe(401);
  });

  it('creates, lists, updates, and deletes a table', async () => {
    const token = await getAuthToken(app);

    const createRes = await request(app)
      .post('/admin/tables')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Table 9', capacity: 6 });
    expect(createRes.status).toBe(201);
    const tableId = createRes.body.id;

    const listRes = await request(app).get('/admin/tables').set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);

    const updateRes = await request(app)
      .patch(`/admin/tables/${tableId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ capacity: 8 });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.capacity).toBe(8);

    const deleteRes = await request(app)
      .delete(`/admin/tables/${tableId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(204);
  });

  it('returns 409 when deleting a table with a future confirmed booking', async () => {
    const token = await getAuthToken(app);
    const table = await prisma.table.create({ data: { name: 'Table 1', capacity: 4 } });
    const slot = await prisma.timeSlot.create({
      data: { label: 'Lunch', startTime: '12:00', durationMinutes: 90 },
    });
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    await prisma.booking.create({
      data: {
        date: futureDate,
        partySize: 2,
        guestName: 'Guest',
        guestEmail: 'guest@test.com',
        tableId: table.id,
        slotId: slot.id,
      },
    });

    const res = await request(app)
      .delete(`/admin/tables/${table.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
  });
});
