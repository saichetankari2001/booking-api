import { useQuery } from '@tanstack/react-query';
import { fetchAdminSlots } from '../api/adminSlots';

export function useAdminSlots() {
  return useQuery({ queryKey: ['admin', 'slots'], queryFn: fetchAdminSlots });
}
