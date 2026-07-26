import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../mocks/server';
import { AppRoutes } from '../../src/App';
import { AdminAuthProvider } from '../../src/context/AdminAuthContext';

const booking = {
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

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AdminAuthProvider>
        <MemoryRouter initialEntries={['/admin/login']}>
          <AppRoutes />
        </MemoryRouter>
      </AdminAuthProvider>
    </QueryClientProvider>,
  );
}

describe('admin cancel booking flow', () => {
  it('logs in and cancels a booking from the admin bookings list', async () => {
    let status: 'confirmed' | 'cancelled' = 'confirmed';
    server.use(
      http.post('http://localhost:3000/auth/login', () =>
        HttpResponse.json({ accessToken: 'access-1', refreshToken: 'refresh-1' }),
      ),
      http.get('http://localhost:3000/admin/bookings', () =>
        HttpResponse.json({ bookings: [{ ...booking, status }], total: 1 }),
      ),
      http.get('http://localhost:3000/admin/tables', () =>
        HttpResponse.json([
          {
            id: 5,
            name: 'Table 5',
            capacity: 4,
            description: null,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ]),
      ),
      http.get('http://localhost:3000/admin/slots', () =>
        HttpResponse.json([
          {
            id: 1,
            label: 'Lunch 12:00',
            startTime: '12:00',
            durationMinutes: 90,
            isActive: true,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ]),
      ),
      http.patch('http://localhost:3000/admin/bookings/booking-1', () => {
        status = 'cancelled';
        return HttpResponse.json({ ...booking, status: 'cancelled' });
      }),
    );

    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByLabelText('Email'), 'admin@test.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm cancellation' }));

    await waitFor(() => expect(screen.getByText('cancelled')).toBeInTheDocument());
  });
});
