import { request } from './apiClient';
import { Slot } from './types';

export function fetchSlots(): Promise<Slot[]> {
  return request<Slot[]>('/slots');
}
