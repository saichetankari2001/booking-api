import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../../mocks/server';
import Book from '../../../src/pages/Book';

let capturedLocation = '';

function LocationDisplay() {
  const location = useLocation();
  capturedLocation = `${location.pathname}${location.search}`;
  return null;
}

function renderBook(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  capturedLocation = '';
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/book"
            element={
              <>
                <Book />
                <LocationDisplay />
              </>
            }
          />
          <Route path="/bookings/:id" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const availableTable = {
  id: 5,
  name: 'Table 5',
  capacity: 4,
  description: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('Book', () => {
  it('shows a "start over" message when query params are missing', () => {
    renderBook('/book');
    expect(screen.getByText('Start over')).toBeInTheDocument();
  });

  it('shows a message when no tables are available', async () => {
    server.use(http.get('http://localhost:3000/tables/available', () => HttpResponse.json([])));
    renderBook('/book?date=2026-08-01&partySize=2&slotId=1');
    expect(
      await screen.findByText('No tables available for this date, time, and party size.'),
    ).toBeInTheDocument();
  });

  it('lets the guest pick a table, submit the form, and navigates to the confirmation page', async () => {
    server.use(
      http.get('http://localhost:3000/tables/available', () => HttpResponse.json([availableTable])),
      http.post('http://localhost:3000/bookings', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.tableId).toBe(5);
        expect(body.date).toBe('2026-08-01');
        expect(body.slotId).toBe(1);
        expect(body.partySize).toBe(2);
        return HttpResponse.json(
          {
            id: 'booking-abc',
            date: '2026-08-01',
            status: 'confirmed',
            partySize: 2,
            guestName: body.guestName,
            guestEmail: body.guestEmail,
            guestPhone: null,
            notes: null,
            tableId: 5,
            slotId: 1,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    renderBook('/book?date=2026-08-01&partySize=2&slotId=1');

    await user.click(await screen.findByText('Table 5'));
    await user.type(screen.getByLabelText('Name'), 'Jane Doe');
    await user.type(screen.getByLabelText('Email'), 'jane@example.com');
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));

    await waitFor(() => expect(capturedLocation).toBe('/bookings/booking-abc'));
  });

  it('shows the API error when booking creation fails', async () => {
    server.use(
      http.get('http://localhost:3000/tables/available', () => HttpResponse.json([availableTable])),
      http.post('http://localhost:3000/bookings', () =>
        HttpResponse.json({ error: 'ConflictError', message: 'Table was just booked' }, { status: 409 }),
      ),
    );

    const user = userEvent.setup();
    renderBook('/book?date=2026-08-01&partySize=2&slotId=1');

    await user.click(await screen.findByText('Table 5'));
    await user.type(screen.getByLabelText('Name'), 'Jane Doe');
    await user.type(screen.getByLabelText('Email'), 'jane@example.com');
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));

    expect(await screen.findByText('Table was just booked')).toBeInTheDocument();
  });
});
