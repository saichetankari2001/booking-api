import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { createBooking, fetchBooking, cancelBooking } from '../../../src/api/bookings';

const sampleBooking = {
  id: 'booking-1',
  date: '2026-08-01',
  status: 'confirmed',
  partySize: 2,
  guestName: 'Jane Doe',
  guestEmail: 'jane@example.com',
  guestPhone: null,
  notes: null,
  tableId: 5,
  slotId: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('bookings api', () => {
  it('createBooking posts the payload and returns the created booking', async () => {
    server.use(
      http.post('http://localhost:3000/bookings', () => HttpResponse.json(sampleBooking, { status: 201 })),
    );
    const result = await createBooking({
      date: '2026-08-01',
      slotId: 1,
      partySize: 2,
      guestName: 'Jane Doe',
      guestEmail: 'jane@example.com',
      tableId: 5,
    });
    expect(result).toEqual(sampleBooking);
  });

  it('fetchBooking gets the booking by id', async () => {
    server.use(
      http.get('http://localhost:3000/bookings/booking-1', () => HttpResponse.json(sampleBooking)),
    );
    const result = await fetchBooking('booking-1');
    expect(result).toEqual(sampleBooking);
  });

  it('cancelBooking sends a DELETE and resolves with no content', async () => {
    server.use(
      http.delete('http://localhost:3000/bookings/booking-1', () => new HttpResponse(null, { status: 204 })),
    );
    await expect(cancelBooking('booking-1')).resolves.toBeUndefined();
  });
});
