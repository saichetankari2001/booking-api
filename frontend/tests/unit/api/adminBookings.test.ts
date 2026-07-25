import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import {
  fetchAdminBookings,
  cancelAdminBooking,
  reassignAdminBooking,
} from '../../../src/api/adminBookings';

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

describe('adminBookings api', () => {
  it('fetchAdminBookings builds the query string from the given filters', async () => {
    server.use(
      http.get('http://localhost:3000/admin/bookings', ({ request: req }) => {
        const url = new URL(req.url);
        expect(url.searchParams.get('date')).toBe('2026-08-01');
        expect(url.searchParams.get('status')).toBe('confirmed');
        expect(url.searchParams.get('page')).toBe('2');
        expect(url.searchParams.get('pageSize')).toBe('20');
        return HttpResponse.json({ bookings: [sampleBooking], total: 1 });
      }),
    );
    const result = await fetchAdminBookings({
      date: '2026-08-01',
      status: 'confirmed',
      page: 2,
      pageSize: 20,
    });
    expect(result).toEqual({ bookings: [sampleBooking], total: 1 });
  });

  it('cancelAdminBooking PATCHes status: cancelled', async () => {
    server.use(
      http.patch('http://localhost:3000/admin/bookings/booking-1', async ({ request: req }) => {
        const body = await req.json();
        expect(body).toEqual({ status: 'cancelled' });
        return HttpResponse.json({ ...sampleBooking, status: 'cancelled' });
      }),
    );
    const result = await cancelAdminBooking('booking-1');
    expect(result.status).toBe('cancelled');
  });

  it('reassignAdminBooking PATCHes the new tableId', async () => {
    server.use(
      http.patch('http://localhost:3000/admin/bookings/booking-1', async ({ request: req }) => {
        const body = await req.json();
        expect(body).toEqual({ tableId: 9 });
        return HttpResponse.json({ ...sampleBooking, tableId: 9 });
      }),
    );
    const result = await reassignAdminBooking('booking-1', 9);
    expect(result.tableId).toBe(9);
  });
});
