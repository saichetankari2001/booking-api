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

describe('Admin booking management', () => {
  it('returns 401 for GET /admin/bookings without a token', async () => {
    const res = await request(app).get('/admin/bookings');
    expect(res.status).toBe(401);
  });

  it('logs in then lists bookings with a valid token', async () => {
    const token = await getAuthToken(app);

    const res = await request(app).get('/admin/bookings').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ bookings: [], total: 0 });
  });

  it('cancels a booking via PATCH', async () => {
    const token = await getAuthToken(app);
    const table = await prisma.table.create({ data: { name: 'Table 1', capacity: 4 } });
    const slot = await prisma.timeSlot.create({
      data: { label: 'Lunch', startTime: '12:00', durationMinutes: 90 },
    });
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    const booking = await prisma.booking.create({
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
      .patch(`/admin/bookings/${booking.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
  });
});
