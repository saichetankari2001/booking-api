import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequireAdmin } from '../../../src/components/RequireAdmin';
import { useAdminAuth } from '../../../src/context/AdminAuthContext';

vi.mock('../../../src/context/AdminAuthContext', () => ({
  useAdminAuth: vi.fn(),
}));

function renderWithStatus(status: 'pending' | 'authenticated' | 'unauthenticated') {
  vi.mocked(useAdminAuth).mockReturnValue({ status, login: vi.fn(), logout: vi.fn() });
  render(
    <MemoryRouter initialEntries={['/admin/bookings']}>
      <Routes>
        <Route path="/admin/login" element={<div>Login page</div>} />
        <Route
          path="/admin/bookings"
          element={
            <RequireAdmin>
              <div>Protected content</div>
            </RequireAdmin>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAdmin', () => {
  it('shows a loading state while auth status is pending', () => {
    renderWithStatus('pending');
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    renderWithStatus('authenticated');
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('redirects to /admin/login when unauthenticated', () => {
    renderWithStatus('unauthenticated');
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });
});
