import { useQuery } from '@tanstack/react-query';
import { fetchAdminTables } from '../api/adminTables';

export function useAdminTables() {
  return useQuery({ queryKey: ['admin', 'tables'], queryFn: fetchAdminTables });
}
