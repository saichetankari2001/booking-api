import { z } from 'zod';

export const createTableFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  capacity: z.coerce.number().int().positive('Capacity must be a positive number'),
  description: z.string().optional(),
});

export const updateTableFormSchema = z.object({
  name: z.string().min(1).optional(),
  capacity: z.coerce.number().int().positive().optional(),
  description: z.string().optional(),
});

export type CreateTableFormInput = z.infer<typeof createTableFormSchema>;
export type UpdateTableFormInput = z.infer<typeof updateTableFormSchema>;
