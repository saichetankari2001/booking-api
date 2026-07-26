import { describe, it, expect } from 'vitest';
import { loginFormSchema } from '../../../../src/lib/schemas/auth.schema';

describe('loginFormSchema', () => {
  it('accepts a valid login', () => {
    expect(
      loginFormSchema.safeParse({ email: 'admin@restaurant.com', password: 'password123' }).success,
    ).toBe(true);
  });

  it('rejects a missing password', () => {
    expect(loginFormSchema.safeParse({ email: 'admin@restaurant.com', password: '' }).success).toBe(
      false,
    );
  });
});
