import { useQuery } from '@tanstack/react-query';
import { fetchAvailableTables, AvailableTablesParams } from '../api/tables';

export function useAvailableTables(params: AvailableTablesParams | null) {
  return useQuery({
    queryKey: ['tables', 'available', params],
    queryFn: () => fetchAvailableTables(params as AvailableTablesParams),
    enabled: params !== null,
  });
}
