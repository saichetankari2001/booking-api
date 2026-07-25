import { request } from './apiClient';
import { Slot } from './types';

export function fetchAdminSlots(): Promise<Slot[]> {
  return request<Slot[]>('/admin/slots', { authenticated: true });
}
