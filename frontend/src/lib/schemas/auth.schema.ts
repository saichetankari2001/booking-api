import { z } from 'zod';

export const loginFormSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginFormInput = z.infer<typeof loginFormSchema>;
