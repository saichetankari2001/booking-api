import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAdminTables,
  createAdminTable,
  updateAdminTable,
  deleteAdminTable,
} from '../api/adminTables';
import { CreateTableFormInput, UpdateTableFormInput } from '../lib/schemas/table.schema';

export function useAdminTables() {
  return useQuery({ queryKey: ['admin', 'tables'], queryFn: fetchAdminTables });
}

export function useCreateTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTableFormInput) => createAdminTable(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'tables'] }),
  });
}

export function useUpdateTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateTableFormInput }) =>
      updateAdminTable(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'tables'] }),
  });
}

export function useDeleteTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteAdminTable(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'tables'] }),
  });
}
