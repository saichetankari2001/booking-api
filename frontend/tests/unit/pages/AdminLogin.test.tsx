import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { server } from '../../mocks/server';
import { AdminAuthProvider } from '../../../src/context/AdminAuthContext';
import AdminLogin from '../../../src/pages/AdminLogin';

function renderLogin() {
  render(
    <AdminAuthProvider>
      <MemoryRouter initialEntries={['/admin/login']}>
        <Routes>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/bookings" element={<div>Bookings page</div>} />
        </Routes>
      </MemoryRouter>
    </AdminAuthProvider>,
  );
}

describe('AdminLogin', () => {
  it('logs in and navigates to /admin/bookings on success', async () => {
    server.use(
      http.post('http://localhost:3000/auth/login', () =>
        HttpResponse.json({ accessToken: 'access-1', refreshToken: 'refresh-1' }),
      ),
    );
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'admin@test.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(screen.getByText('Bookings page')).toBeInTheDocument());
  });

  it('shows an error message on invalid credentials', async () => {
    server.use(
      http.post('http://localhost:3000/auth/login', () =>
        HttpResponse.json(
          { error: 'UnauthorizedError', message: 'Invalid email or password' },
          { status: 401 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'admin@test.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
  });
});
