import { http, HttpResponse } from 'msw';

const API_BASE_URL = 'http://localhost:3000';

export const handlers = [
  http.get(`${API_BASE_URL}/slots`, () =>
    HttpResponse.json([
      {
        id: 1,
        label: 'Lunch 12:00',
        startTime: '12:00',
        durationMinutes: 90,
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 2,
        label: 'Dinner 18:00',
        startTime: '18:00',
        durationMinutes: 90,
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]),
  ),
];
