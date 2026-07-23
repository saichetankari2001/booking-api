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

async function seedTableAndSlot() {
  const table = await prisma.table.create({ data: { name: 'Table 1', capacity: 4 } });
  const slot = await prisma.timeSlot.create({
    data: { label: 'Lunch', startTime: '12:00', durationMinutes: 90, isActive: true },
  });
  return { table, slot };
}

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

describe('POST /bookings', () => {
  it('creates a booking end-to-end and assigns a table', async () => {
    const { slot } = await seedTableAndSlot();
    const res = await request(app).post('/bookings').send({
      date: tomorrow(),
      slotId: slot.id,
      partySize: 2,
      guestName: 'Alice',
      guestEmail: 'alice@test.com',
    });
    expect(res.status).toBe(201);
    expect(res.body.tableId).toEqual(expect.any(Number));
    expect(res.body.status).toBe('confirmed');
  });

  it('returns 409 when the same table+slot+date is booked twice', async () => {
    const { table, slot } = await seedTableAndSlot();
    const first = await request(app).post('/bookings').send({
      date: tomorrow(),
      slotId: slot.id,
      partySize: 2,
      guestName: 'Alice',
      guestEmail: 'alice@test.com',
      tableId: table.id,
    });
    expect(first.status).toBe(201);

    const second = await request(app).post('/bookings').send({
      date: tomorrow(),
      slotId: slot.id,
      partySize: 2,
      guestName: 'Bob',
      guestEmail: 'bob@test.com',
      tableId: table.id,
    });
    expect(second.status).toBe(409);
  });

  it('returns 422 for an invalid body', async () => {
    const res = await request(app).post('/bookings').send({ date: 'not-a-date' });
    expect(res.status).toBe(422);
  });
});

describe('GET /bookings/:id and DELETE /bookings/:id', () => {
  it('fetches and then cancels a booking by id', async () => {
    const { slot } = await seedTableAndSlot();
    const createRes = await request(app).post('/bookings').send({
      date: tomorrow(),
      slotId: slot.id,
      partySize: 2,
      guestName: 'Alice',
      guestEmail: 'alice@test.com',
    });
    const id = createRes.body.id;

    const getRes = await request(app).get(`/bookings/${id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(id);

    const deleteRes = await request(app).delete(`/bookings/${id}`);
    expect(deleteRes.status).toBe(204);

    const afterDelete = await request(app).get(`/bookings/${id}`);
    expect(afterDelete.body.status).toBe('cancelled');
  });

  it('returns 404 for a non-existent booking id', async () => {
    const res = await request(app).get('/bookings/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});
