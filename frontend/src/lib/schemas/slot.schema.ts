import { z } from 'zod';

export const createSlotFormSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
  durationMinutes: z.coerce.number().int().positive().default(90),
  isActive: z.boolean().optional(),
});

export const updateSlotFormSchema = z.object({
  label: z.string().min(1).optional(),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Use HH:MM format')
    .optional(),
  durationMinutes: z.coerce.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

export type CreateSlotFormInput = z.infer<typeof createSlotFormSchema>;
export type UpdateSlotFormInput = z.infer<typeof updateSlotFormSchema>;
