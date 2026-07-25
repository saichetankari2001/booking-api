import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../../mocks/server';
import AdminBookings from '../../../src/pages/AdminBookings';

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

const tablesHandler = http.get('http://localhost:3000/admin/tables', () =>
  HttpResponse.json([
    { id: 5, name: 'Table 5', capacity: 4, description: null, createdAt: '2026-01-01T00:00:00.000Z' },
  ]),
);
const slotsHandler = http.get('http://localhost:3000/admin/slots', () =>
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
);

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminBookings />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminBookings', () => {
  it('lists bookings with resolved table names and slot labels', async () => {
    server.use(
      http.get('http://localhost:3000/admin/bookings', () =>
        HttpResponse.json({ bookings: [booking], total: 1 }),
      ),
      tablesHandler,
      slotsHandler,
    );
    renderPage();

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Table 5')).toBeInTheDocument();
    expect(screen.getByText('Lunch 12:00')).toBeInTheDocument();
  });

  it('cancels a booking through the confirm dialog', async () => {
    let status: 'confirmed' | 'cancelled' = 'confirmed';
    server.use(
      http.get('http://localhost:3000/admin/bookings', () =>
        HttpResponse.json({ bookings: [{ ...booking, status }], total: 1 }),
      ),
      tablesHandler,
      slotsHandler,
      http.patch('http://localhost:3000/admin/bookings/booking-1', () => {
        status = 'cancelled';
        return HttpResponse.json({ ...booking, status: 'cancelled' });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm cancellation' }));

    await waitFor(() => expect(screen.getByText('cancelled')).toBeInTheDocument());
  });
});
