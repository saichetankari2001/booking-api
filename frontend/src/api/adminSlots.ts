import { request } from './apiClient';
import { Slot } from './types';
import { CreateSlotFormInput, UpdateSlotFormInput } from '../lib/schemas/slot.schema';

export function fetchAdminSlots(): Promise<Slot[]> {
  return request<Slot[]>('/admin/slots', { authenticated: true });
}

export function createAdminSlot(payload: CreateSlotFormInput): Promise<Slot> {
  return request<Slot>('/admin/slots', {
    method: 'POST',
    body: JSON.stringify(payload),
    authenticated: true,
  });
}

export function updateAdminSlot(id: number, payload: UpdateSlotFormInput): Promise<Slot> {
  return request<Slot>(`/admin/slots/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    authenticated: true,
  });
}

export function deleteAdminSlot(id: number): Promise<void> {
  return request<void>(`/admin/slots/${id}`, { method: 'DELETE', authenticated: true });
}
