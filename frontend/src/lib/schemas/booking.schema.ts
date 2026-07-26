import { z } from 'zod';

export const guestBookingFormSchema = z.object({
  guestName: z.string().min(1, 'Name is required'),
  guestEmail: z.string().email('Enter a valid email'),
  guestPhone: z.string().optional(),
  notes: z.string().optional(),
});

export type GuestBookingFormInput = z.infer<typeof guestBookingFormSchema>;
