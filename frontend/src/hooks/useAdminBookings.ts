import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAdminBookings,
  cancelAdminBooking,
  reassignAdminBooking,
  AdminBookingListParams,
} from '../api/adminBookings';

export function useAdminBookings(params: AdminBookingListParams) {
  return useQuery({
    queryKey: ['admin', 'bookings', params],
    queryFn: () => fetchAdminBookings(params),
  });
}

export function useCancelAdminBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelAdminBooking(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'bookings'] });
    },
  });
}

export function useReassignAdminBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tableId }: { id: string; tableId: number }) =>
      reassignAdminBooking(id, tableId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'bookings'] });
    },
  });
}
