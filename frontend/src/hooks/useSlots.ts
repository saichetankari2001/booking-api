import { useQuery } from '@tanstack/react-query';
import { fetchSlots } from '../api/slots';

export function useSlots() {
  return useQuery({ queryKey: ['slots'], queryFn: fetchSlots });
}
