import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { fetchAvailableTables } from '../../../src/api/tables';

describe('fetchAvailableTables', () => {
  it('requests /tables/available with the given query params', async () => {
    server.use(
      http.get('http://localhost:3000/tables/available', ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('slotId')).toBe('1');
        expect(url.searchParams.get('date')).toBe('2026-08-01');
        expect(url.searchParams.get('partySize')).toBe('2');
        return HttpResponse.json([
          {
            id: 3,
            name: 'Table 3',
            capacity: 4,
            description: null,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ]);
      }),
    );

    const tables = await fetchAvailableTables({ slotId: 1, date: '2026-08-01', partySize: 2 });
    expect(tables).toEqual([
      {
        id: 3,
        name: 'Table 3',
        capacity: 4,
        description: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });
});
