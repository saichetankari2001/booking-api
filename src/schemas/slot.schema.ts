import { z } from 'zod';

export const createSlotSchema = z.object({
  label: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'startTime must be HH:MM'),
  durationMinutes: z.coerce.number().int().positive().default(90),
  isActive: z.boolean().optional(),
});

export const updateSlotSchema = z.object({
  label: z.string().min(1).optional(),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  durationMinutes: z.coerce.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

export const slotIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateSlotInput = z.infer<typeof createSlotSchema>;
export type UpdateSlotInput = z.infer<typeof updateSlotSchema>;
