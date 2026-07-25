import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../mocks/server';
import { AppRoutes } from '../../src/App';

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('guest booking flow', () => {
  it('books a table end-to-end from the homepage to the confirmation page', async () => {
    server.use(
      http.get('http://localhost:3000/tables/available', () =>
        HttpResponse.json([
          { id: 5, name: 'Table 5', capacity: 4, description: null, createdAt: '2026-01-01T00:00:00.000Z' },
        ]),
      ),
      http.post('http://localhost:3000/bookings', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            id: 'booking-flow-1',
            date: body.date,
            status: 'confirmed',
            partySize: body.partySize,
            guestName: body.guestName,
            guestEmail: body.guestEmail,
            guestPhone: null,
            notes: null,
            tableId: body.tableId,
            slotId: body.slotId,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          { status: 201 },
        );
      }),
      http.get('http://localhost:3000/bookings/booking-flow-1', () =>
        HttpResponse.json({
          id: 'booking-flow-1',
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
        }),
      ),
    );

    const user = userEvent.setup();
    renderApp();

    await screen.findByText('Lunch 12:00');
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08-01' } });
    await user.type(screen.getByLabelText('Party size'), '2');
    await user.selectOptions(screen.getByLabelText('Time'), '1');
    await user.click(screen.getByRole('button', { name: 'Check availability' }));

    await user.click(await screen.findByText('Table 5'));
    await user.type(screen.getByLabelText('Name'), 'Jane Doe');
    await user.type(screen.getByLabelText('Email'), 'jane@example.com');
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));

    expect(await screen.findByText("You're booked!")).toBeInTheDocument();
    expect(screen.getByText('Lunch 12:00')).toBeInTheDocument();
  });
});
