import { request } from './apiClient';
import { AdminBookingListResponse, Booking, BookingStatus } from './types';

export interface AdminBookingListParams {
  date?: string;
  status?: BookingStatus;
  slotId?: number;
  page?: number;
  pageSize?: number;
}

export function fetchAdminBookings(
  params: AdminBookingListParams,
): Promise<AdminBookingListResponse> {
  const query = new URLSearchParams();
  if (params.date) query.set('date', params.date);
  if (params.status) query.set('status', params.status);
  if (params.slotId !== undefined) query.set('slotId', String(params.slotId));
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.pageSize !== undefined) query.set('pageSize', String(params.pageSize));
  const qs = query.toString();
  return request<AdminBookingListResponse>(`/admin/bookings${qs ? `?${qs}` : ''}`, {
    authenticated: true,
  });
}

export function cancelAdminBooking(id: string): Promise<Booking> {
  return request<Booking>(`/admin/bookings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'cancelled' }),
    authenticated: true,
  });
}

export function reassignAdminBooking(id: string, tableId: number): Promise<Booking> {
  return request<Booking>(`/admin/bookings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ tableId }),
    authenticated: true,
  });
}
