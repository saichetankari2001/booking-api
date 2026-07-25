import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../../mocks/server';
import AdminTables from '../../../src/pages/AdminTables';
import { Table } from '../../../src/api/types';

const table = {
  id: 1,
  name: 'Table 1',
  capacity: 2,
  description: '',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminTables />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminTables', () => {
  it('lists tables and creates a new one', async () => {
    let tables: Table[] = [table];
    server.use(
      http.get('http://localhost:3000/admin/tables', () => HttpResponse.json(tables)),
      http.post('http://localhost:3000/admin/tables', async ({ request: req }) => {
        const body = (await req.json()) as { name: string; capacity: number; description?: string };
        const created = {
          id: 2,
          name: body.name,
          capacity: body.capacity,
          description: body.description ?? null,
          createdAt: '2026-01-01T00:00:00.000Z',
        };
        tables = [...tables, created];
        return HttpResponse.json(created, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Table 1')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Name'), 'Table 2');
    await user.type(screen.getByLabelText('Capacity'), '4');
    await user.click(screen.getByRole('button', { name: 'Add table' }));

    expect(await screen.findByText('Table 2')).toBeInTheDocument();
  });

  it('edits a table', async () => {
    let currentTable = { ...table };
    server.use(
      http.get('http://localhost:3000/admin/tables', () => HttpResponse.json([currentTable])),
      http.patch('http://localhost:3000/admin/tables/1', async ({ request: req }) => {
        const body = (await req.json()) as Record<string, unknown>;
        currentTable = { ...currentTable, ...body } as typeof currentTable;
        return HttpResponse.json(currentTable);
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const nameInput = screen.getByLabelText('Edit name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Renamed Table');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Renamed Table')).toBeInTheDocument();
  });

  it('shows the conflict error when deleting a table with future bookings', async () => {
    server.use(
      http.get('http://localhost:3000/admin/tables', () => HttpResponse.json([table])),
      http.delete('http://localhost:3000/admin/tables/1', () =>
        HttpResponse.json(
          { error: 'ConflictError', message: 'Table has future confirmed bookings' },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'Delete table' }));

    expect(await screen.findByText('Table has future confirmed bookings')).toBeInTheDocument();
  });
});
