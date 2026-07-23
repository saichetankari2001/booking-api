import { z } from 'zod';

export const createTableSchema = z.object({
  name: z.string().min(1),
  capacity: z.coerce.number().int().positive(),
  description: z.string().optional(),
});

export const updateTableSchema = z.object({
  name: z.string().min(1).optional(),
  capacity: z.coerce.number().int().positive().optional(),
  description: z.string().optional(),
});

export const tableIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateTableInput = z.infer<typeof createTableSchema>;
export type UpdateTableInput = z.infer<typeof updateTableSchema>;
