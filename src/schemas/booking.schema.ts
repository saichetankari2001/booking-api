import { z } from 'zod';

export const createBookingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  slotId: z.coerce.number().int().positive(),
  partySize: z.coerce.number().int().positive(),
  guestName: z.string().min(1),
  guestEmail: z.string().email(),
  guestPhone: z.string().optional(),
  notes: z.string().optional(),
  tableId: z.coerce.number().int().positive().optional(),
});

export const bookingIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const availableTablesQuerySchema = z.object({
  slotId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partySize: z.coerce.number().int().positive(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const adminListBookingsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['confirmed', 'cancelled']).optional(),
  slotId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const adminUpdateBookingSchema = z
  .object({
    status: z.literal('cancelled').optional(),
    tableId: z.coerce.number().int().positive().optional(),
  })
  .refine((data) => data.status !== undefined || data.tableId !== undefined, {
    message: 'Either status or tableId must be provided',
  });
