import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Home from '../../../src/pages/Home';

let capturedLocation = '';

function LocationDisplay() {
  const location = useLocation();
  capturedLocation = `${location.pathname}${location.search}`;
  return null;
}

function renderHome() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  capturedLocation = '';
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <Home />
                <LocationDisplay />
              </>
            }
          />
          <Route path="/book" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Home', () => {
  it('lists time slots loaded from the API', async () => {
    renderHome();
    expect(await screen.findByText('Lunch 12:00')).toBeInTheDocument();
    expect(screen.getByText('Dinner 18:00')).toBeInTheDocument();
  });

  it('disables submit until date, party size, and slot are all set', async () => {
    renderHome();
    await screen.findByText('Lunch 12:00');
    expect(screen.getByRole('button', { name: 'Check availability' })).toBeDisabled();
  });

  it('navigates to /book with the selected values as query params', async () => {
    const user = userEvent.setup();
    renderHome();
    await screen.findByText('Lunch 12:00');

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08-01' } });
    await user.type(screen.getByLabelText('Party size'), '4');
    await user.selectOptions(screen.getByLabelText('Time'), '1');
    await user.click(screen.getByRole('button', { name: 'Check availability' }));

    expect(capturedLocation).toBe('/book?date=2026-08-01&partySize=4&slotId=1');
  });
});
