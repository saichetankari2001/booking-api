import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AdminNav } from '../../../src/components/AdminNav';
import { useAdminAuth } from '../../../src/context/AdminAuthContext';

vi.mock('../../../src/context/AdminAuthContext', () => ({
  useAdminAuth: vi.fn(),
}));

describe('AdminNav', () => {
  it('renders nav links and calls logout on click', async () => {
    const logout = vi.fn();
    vi.mocked(useAdminAuth).mockReturnValue({ status: 'authenticated', login: vi.fn(), logout });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminNav />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Bookings' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tables' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Slots' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
