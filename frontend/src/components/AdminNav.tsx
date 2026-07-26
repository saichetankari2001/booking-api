import { NavLink } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Button } from './Button';

const links = [
  { to: '/admin/bookings', label: 'Bookings' },
  { to: '/admin/tables', label: 'Tables' },
  { to: '/admin/slots', label: 'Slots' },
];

export function AdminNav() {
  const { logout } = useAdminAuth();
  return (
    <nav className="flex items-center justify-between border-b border-border px-6 py-4">
      <div className="flex gap-6">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              isActive ? 'font-medium text-accent' : 'text-text/70 hover:text-text'
            }
          >
            {link.label}
          </NavLink>
        ))}
      </div>
      <Button variant="secondary" onClick={logout}>
        Log out
      </Button>
    </nav>
  );
}
