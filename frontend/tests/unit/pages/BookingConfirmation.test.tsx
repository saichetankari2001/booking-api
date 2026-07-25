import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../../mocks/server';
import BookingConfirmation from '../../../src/pages/BookingConfirmation';

function renderConfirmation(id: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/bookings/${id}`]}>
        <Routes>
          <Route path="/bookings/:id" element={<BookingConfirmation />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const baseBooking = {
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

describe('BookingConfirmation', () => {
  it('shows booking details with the resolved slot label and table number', async () => {
    server.use(
      http.get('http://localhost:3000/bookings/booking-1', () => HttpResponse.json(baseBooking)),
    );
    renderConfirmation('booking-1');

    expect(await screen.findByText("You're booked!")).toBeInTheDocument();
    expect(screen.getByText('Lunch 12:00')).toBeInTheDocument();
    expect(screen.getByText('Table #5')).toBeInTheDocument();
  });

  it('shows a not-found message when the booking does not exist', async () => {
    server.use(
      http.get('http://localhost:3000/bookings/missing', () =>
        HttpResponse.json(
          { error: 'NotFoundError', message: 'Booking missing not found' },
          { status: 404 },
        ),
      ),
    );
    renderConfirmation('missing');
    expect(await screen.findByText("We couldn't find that booking.")).toBeInTheDocument();
  });

  it('cancels the booking through the confirm dialog', async () => {
    let cancelled = false;
    server.use(
      http.get('http://localhost:3000/bookings/booking-1', () =>
        HttpResponse.json({ ...baseBooking, status: cancelled ? 'cancelled' : 'confirmed' }),
      ),
      http.delete('http://localhost:3000/bookings/booking-1', () => {
        cancelled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderConfirmation('booking-1');

    await user.click(await screen.findByRole('button', { name: 'Cancel booking' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm cancellation' }));

    await waitFor(() => expect(screen.getByText('cancelled')).toBeInTheDocument());
  });
});
