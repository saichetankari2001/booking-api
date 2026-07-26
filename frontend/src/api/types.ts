export type BookingStatus = 'confirmed' | 'cancelled';

export interface Booking {
  id: string;
  date: string;
  status: BookingStatus;
  partySize: number;
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
  notes: string | null;
  tableId: number;
  slotId: number;
  createdAt: string;
  updatedAt: string;
}

export interface Table {
  id: number;
  name: string;
  capacity: number;
  description: string | null;
  createdAt: string;
}

export interface Slot {
  id: number;
  label: string;
  startTime: string;
  durationMinutes: number;
  isActive: boolean;
  createdAt: string;
}

export interface AdminBookingListResponse {
  bookings: Booking[];
  total: number;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
}
