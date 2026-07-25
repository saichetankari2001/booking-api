import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../../mocks/server';
import AdminSlots from '../../../src/pages/AdminSlots';

const slot = {
  id: 1,
  label: 'Lunch 12:00',
  startTime: '12:00',
  durationMinutes: 90,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminSlots />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminSlots', () => {
  it('lists slots and creates a new one', async () => {
    let slots = [slot];
    server.use(
      http.get('http://localhost:3000/admin/slots', () => HttpResponse.json(slots)),
      http.post('http://localhost:3000/admin/slots', async ({ request: req }) => {
        const body = (await req.json()) as {
          label: string;
          startTime: string;
          durationMinutes: number;
        };
        const created = { id: 2, ...body, isActive: true, createdAt: '2026-01-01T00:00:00.000Z' };
        slots = [...slots, created];
        return HttpResponse.json(created, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Lunch 12:00')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Label'), 'Dinner 18:00');
    await user.type(screen.getByLabelText('Start time'), '18:00');
    await user.type(screen.getByLabelText('Duration (min)'), '90');
    await user.click(screen.getByRole('button', { name: 'Add slot' }));

    expect(await screen.findByText('Dinner 18:00')).toBeInTheDocument();
  });

  it('edits a slot', async () => {
    let currentSlot = { ...slot };
    server.use(
      http.get('http://localhost:3000/admin/slots', () => HttpResponse.json([currentSlot])),
      http.patch('http://localhost:3000/admin/slots/1', async ({ request: req }) => {
        const body = (await req.json()) as Record<string, unknown>;
        currentSlot = { ...currentSlot, ...body } as typeof currentSlot;
        return HttpResponse.json(currentSlot);
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const labelInput = screen.getByLabelText('Edit label');
    await user.clear(labelInput);
    await user.type(labelInput, 'Renamed Slot');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Renamed Slot')).toBeInTheDocument();
  });

  it('shows the conflict error when deleting a slot with future bookings', async () => {
    server.use(
      http.get('http://localhost:3000/admin/slots', () => HttpResponse.json([slot])),
      http.delete('http://localhost:3000/admin/slots/1', () =>
        HttpResponse.json(
          { error: 'ConflictError', message: 'Slot has future confirmed bookings' },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'Delete slot' }));

    expect(await screen.findByText('Slot has future confirmed bookings')).toBeInTheDocument();
  });

  it('shows an error when saving an edited slot fails', async () => {
    server.use(
      http.get('http://localhost:3000/admin/slots', () => HttpResponse.json([slot])),
      http.patch('http://localhost:3000/admin/slots/1', () =>
        HttpResponse.json(
          { error: 'ValidationError', message: 'Start time overlaps another slot' },
          { status: 422 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Start time overlaps another slot')).toBeInTheDocument();
  });
});
