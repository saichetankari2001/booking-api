import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { resetDb } from './helpers/resetDb';
import { TableRepository } from '../../src/repositories/table.repository';

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

  it('allows exactly one of two concurrent requests for the same table+slot+date to succeed', async () => {
    // Regression test for the double-booking race: BookingService.create's
    // check-then-insert is not atomic under PostgreSQL's default Read Committed
    // isolation, so two concurrent requests can both pass the "is this table available"
    // check before either has inserted its booking.
    //
    // A plain `Promise.all` of two supertest calls is NOT sufficient to exercise this in
    // practice: measured directly, one request's entire check-insert-commit cycle
    // completes on localhost Postgres in a handful of milliseconds — comfortably before
    // Node even starts the second request's DB work, let alone before it reaches its own
    // check. An unprotected Promise.all test was observed to pass 10/10 even with the
    // race left completely unfixed, which would make it a false proof.
    //
    // To force genuine overlap, both requests' "is this table available" checks are
    // paused (via a barrier below) right before the real DB query fires, and are only
    // released once BOTH requests have reached that point. This reconstructs the actual
    // TOCTOU window: both checks then run and both correctly see the table as available
    // (since neither has inserted yet), and both proceed to insert at essentially the
    // same instant. What happens next — whether both inserts succeed (a real
    // double-booking) or exactly one wins and the other gets a clean 409 — is then
    // entirely decided by real code against the real Postgres test database: the
    // `bookings_confirmed_table_slot_date_key` partial unique index (see
    // prisma/migrations) and the P2002 -> ConflictError handling in BookingService.create.
    const { table, slot } = await seedTableAndSlot();
    const date = tomorrow();

    const realCheck = TableRepository.findAvailableWithSpecificTable.bind(TableRepository);
    let arrivals = 0;
    let releaseBarrier: () => void;
    const barrier = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });
    const checkSpy = jest
      .spyOn(TableRepository, 'findAvailableWithSpecificTable')
      .mockImplementation(async (...args: Parameters<typeof realCheck>) => {
        arrivals += 1;
        if (arrivals >= 2) {
          releaseBarrier();
        }
        // Safety net: if only one call ever arrives (e.g. request A short-circuited
        // before reaching the check), don't hang the test forever.
        await Promise.race([barrier, new Promise((resolve) => setTimeout(resolve, 500))]);
        return realCheck(...args);
      });

    try {
      const [resA, resB] = await Promise.all([
        request(app).post('/bookings').send({
          date,
          slotId: slot.id,
          partySize: 2,
          guestName: 'Alice',
          guestEmail: 'alice@test.com',
          tableId: table.id,
        }),
        request(app).post('/bookings').send({
          date,
          slotId: slot.id,
          partySize: 2,
          guestName: 'Bob',
          guestEmail: 'bob@test.com',
          tableId: table.id,
        }),
      ]);

      const statuses = [resA.status, resB.status].sort();
      expect(statuses).toEqual([201, 409]);

      const confirmedCount = await prisma.booking.count({
        where: { tableId: table.id, slotId: slot.id, date: new Date(date), status: 'confirmed' },
      });
      expect(confirmedCount).toBe(1);
    } finally {
      checkSpy.mockRestore();
    }
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
