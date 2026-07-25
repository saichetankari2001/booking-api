import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAdminBookings,
  cancelAdminBooking,
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
