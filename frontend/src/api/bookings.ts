import { request } from './apiClient';
import { Booking } from './types';

export interface CreateBookingPayload {
  date: string;
  slotId: number;
  partySize: number;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  notes?: string;
  tableId?: number;
}

export function createBooking(payload: CreateBookingPayload): Promise<Booking> {
  return request<Booking>('/bookings', { method: 'POST', body: JSON.stringify(payload) });
}

export function fetchBooking(id: string): Promise<Booking> {
  return request<Booking>(`/bookings/${id}`);
}

export function cancelBooking(id: string): Promise<void> {
  return request<void>(`/bookings/${id}`, { method: 'DELETE' });
}
