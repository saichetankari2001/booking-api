import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Home from './pages/Home';
import Book from './pages/Book';
import BookingConfirmation from './pages/BookingConfirmation';
import AdminLogin from './pages/AdminLogin';
import AdminBookings from './pages/AdminBookings';
import AdminTables from './pages/AdminTables';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { RequireAdmin } from './components/RequireAdmin';
import { AdminNav } from './components/AdminNav';

const queryClient = new QueryClient();

function AdminLayout() {
  return (
    <RequireAdmin>
      <AdminNav />
      <Outlet />
    </RequireAdmin>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/book" element={<Book />} />
      <Route path="/bookings/:id" element={<BookingConfirmation />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="bookings" replace />} />
        <Route path="bookings" element={<AdminBookings />} />
        <Route path="tables" element={<AdminTables />} />
        {/* Task 15 adds "slots" */}
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminAuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AdminAuthProvider>
    </QueryClientProvider>
  );
}
