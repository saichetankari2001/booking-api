import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAdminSlots,
  createAdminSlot,
  updateAdminSlot,
  deleteAdminSlot,
} from '../api/adminSlots';
import { CreateSlotFormInput, UpdateSlotFormInput } from '../lib/schemas/slot.schema';

export function useAdminSlots() {
  return useQuery({ queryKey: ['admin', 'slots'], queryFn: fetchAdminSlots });
}

export function useCreateSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSlotFormInput) => createAdminSlot(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'slots'] }),
  });
}

export function useUpdateSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateSlotFormInput }) =>
      updateAdminSlot(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'slots'] }),
  });
}

export function useDeleteSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteAdminSlot(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'slots'] }),
  });
}
