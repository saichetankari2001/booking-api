import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createBooking, fetchBooking, cancelBooking, CreateBookingPayload } from '../api/bookings';

export function useCreateBooking() {
  return useMutation({
    mutationFn: (payload: CreateBookingPayload) => createBooking(payload),
  });
}

export function useBooking(id: string | undefined) {
  return useQuery({
    queryKey: ['bookings', id],
    queryFn: () => fetchBooking(id as string),
    enabled: id !== undefined,
  });
}

export function useCancelBooking(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => cancelBooking(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings', id] });
    },
  });
}
