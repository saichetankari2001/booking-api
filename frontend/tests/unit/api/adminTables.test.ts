import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import {
  fetchAdminTables,
  createAdminTable,
  updateAdminTable,
  deleteAdminTable,
} from '../../../src/api/adminTables';

const sampleTable = {
  id: 1,
  name: 'Table 1',
  capacity: 2,
  description: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('adminTables api', () => {
  it('fetchAdminTables returns the list of tables', async () => {
    server.use(http.get('http://localhost:3000/admin/tables', () => HttpResponse.json([sampleTable])));
    expect(await fetchAdminTables()).toEqual([sampleTable]);
  });

  it('createAdminTable POSTs the payload', async () => {
    server.use(
      http.post('http://localhost:3000/admin/tables', async ({ request: req }) => {
        const body = await req.json();
        expect(body).toEqual({ name: 'Table 2', capacity: 4 });
        return HttpResponse.json(
          { id: 2, name: 'Table 2', capacity: 4, description: null, createdAt: '2026-01-01T00:00:00.000Z' },
          { status: 201 },
        );
      }),
    );
    const result = await createAdminTable({ name: 'Table 2', capacity: 4 });
    expect(result.id).toBe(2);
  });

  it('updateAdminTable PATCHes the payload', async () => {
    server.use(
      http.patch('http://localhost:3000/admin/tables/1', async ({ request: req }) => {
        const body = await req.json();
        expect(body).toEqual({ capacity: 6 });
        return HttpResponse.json({ ...sampleTable, capacity: 6 });
      }),
    );
    const result = await updateAdminTable(1, { capacity: 6 });
    expect(result.capacity).toBe(6);
  });

  it('deleteAdminTable sends a DELETE', async () => {
    server.use(
      http.delete('http://localhost:3000/admin/tables/1', () => new HttpResponse(null, { status: 204 })),
    );
    await expect(deleteAdminTable(1)).resolves.toBeUndefined();
  });
});
