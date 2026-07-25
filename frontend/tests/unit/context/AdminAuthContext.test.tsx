import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import {
  AdminAuthProvider,
  useAdminAuth,
  REFRESH_TOKEN_KEY,
} from '../../../src/context/AdminAuthContext';
import { request } from '../../../src/api/apiClient';

function AuthProbe() {
  const { status, login, logout } = useAdminAuth();
  return (
    <div>
      <p>status: {status}</p>
      <button onClick={() => login('admin@test.com', 'password123')}>Login</button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
}

function renderProbe() {
  render(
    <AdminAuthProvider>
      <AuthProbe />
    </AdminAuthProvider>,
  );
}

describe('AdminAuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('resolves to unauthenticated when there is no stored refresh token', async () => {
    renderProbe();
    expect(screen.getByText('status: pending')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('status: unauthenticated')).toBeInTheDocument());
  });

  it('silently authenticates on mount when a refresh token is already stored', async () => {
    localStorage.setItem(REFRESH_TOKEN_KEY, 'existing-refresh-token');
    server.use(
      http.post('http://localhost:3000/auth/refresh', () =>
        HttpResponse.json({ accessToken: 'new-access' }),
      ),
    );
    renderProbe();
    await waitFor(() => expect(screen.getByText('status: authenticated')).toBeInTheDocument());
  });

  it('authenticates after a successful login and stores the refresh token', async () => {
    server.use(
      http.post('http://localhost:3000/auth/login', () =>
        HttpResponse.json({ accessToken: 'access-1', refreshToken: 'refresh-1' }),
      ),
    );
    const user = userEvent.setup();
    renderProbe();
    await waitFor(() => expect(screen.getByText('status: unauthenticated')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => expect(screen.getByText('status: authenticated')).toBeInTheDocument());
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-1');
  });

  it('logs out, clearing status and the stored refresh token', async () => {
    server.use(
      http.post('http://localhost:3000/auth/login', () =>
        HttpResponse.json({ accessToken: 'access-1', refreshToken: 'refresh-1' }),
      ),
      http.post('http://localhost:3000/auth/logout', () => new HttpResponse(null, { status: 204 })),
    );
    const user = userEvent.setup();
    renderProbe();
    await waitFor(() => expect(screen.getByText('status: unauthenticated')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Login' }));
    await waitFor(() => expect(screen.getByText('status: authenticated')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Logout' }));

    await waitFor(() => expect(screen.getByText('status: unauthenticated')).toBeInTheDocument());
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });

  it('wires the access token into apiClient so authenticated requests carry it', async () => {
    server.use(
      http.post('http://localhost:3000/auth/login', () =>
        HttpResponse.json({ accessToken: 'access-1', refreshToken: 'refresh-1' }),
      ),
    );
    const user = userEvent.setup();
    renderProbe();
    await waitFor(() => expect(screen.getByText('status: unauthenticated')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Login' }));
    await waitFor(() => expect(screen.getByText('status: authenticated')).toBeInTheDocument());

    let capturedAuth: string | null = null;
    server.use(
      http.get('http://localhost:3000/admin/tables', ({ request: req }) => {
        capturedAuth = req.headers.get('Authorization');
        return HttpResponse.json([]);
      }),
    );
    await request('/admin/tables', { authenticated: true });
    expect(capturedAuth).toBe('Bearer access-1');
  });
});
