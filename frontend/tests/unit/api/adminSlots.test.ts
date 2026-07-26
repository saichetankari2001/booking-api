import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import {
  fetchAdminSlots,
  createAdminSlot,
  updateAdminSlot,
  deleteAdminSlot,
} from '../../../src/api/adminSlots';

const sampleSlot = {
  id: 1,
  label: 'Lunch 12:00',
  startTime: '12:00',
  durationMinutes: 90,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('adminSlots api', () => {
  it('fetchAdminSlots returns the list of slots', async () => {
    server.use(
      http.get('http://localhost:3000/admin/slots', () => HttpResponse.json([sampleSlot])),
    );
    expect(await fetchAdminSlots()).toEqual([sampleSlot]);
  });

  it('createAdminSlot POSTs the payload', async () => {
    server.use(
      http.post('http://localhost:3000/admin/slots', async ({ request: req }) => {
        const body = await req.json();
        expect(body).toEqual({ label: 'Dinner 18:00', startTime: '18:00', durationMinutes: 90 });
        return HttpResponse.json(
          {
            id: 2,
            label: 'Dinner 18:00',
            startTime: '18:00',
            durationMinutes: 90,
            isActive: true,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
          { status: 201 },
        );
      }),
    );
    const result = await createAdminSlot({
      label: 'Dinner 18:00',
      startTime: '18:00',
      durationMinutes: 90,
    });
    expect(result.id).toBe(2);
  });

  it('updateAdminSlot PATCHes the payload', async () => {
    server.use(
      http.patch('http://localhost:3000/admin/slots/1', async ({ request: req }) => {
        const body = await req.json();
        expect(body).toEqual({ isActive: false });
        return HttpResponse.json({ ...sampleSlot, isActive: false });
      }),
    );
    const result = await updateAdminSlot(1, { isActive: false });
    expect(result.isActive).toBe(false);
  });

  it('deleteAdminSlot sends a DELETE', async () => {
    server.use(
      http.delete(
        'http://localhost:3000/admin/slots/1',
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    await expect(deleteAdminSlot(1)).resolves.toBeUndefined();
  });
});
