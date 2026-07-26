import { describe, it, expect } from 'vitest';
import { guestBookingFormSchema } from '../../../../src/lib/schemas/booking.schema';

describe('guestBookingFormSchema', () => {
  it('accepts a valid guest booking form', () => {
    const result = guestBookingFormSchema.safeParse({
      guestName: 'Jane Doe',
      guestEmail: 'jane@example.com',
      guestPhone: '555-1234',
      notes: 'Window seat please',
    });
    expect(result.success).toBe(true);
  });

  it('accepts an empty phone and notes (both optional)', () => {
    const result = guestBookingFormSchema.safeParse({
      guestName: 'Jane Doe',
      guestEmail: 'jane@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = guestBookingFormSchema.safeParse({
      guestName: 'Jane Doe',
      guestEmail: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty guest name', () => {
    const result = guestBookingFormSchema.safeParse({
      guestName: '',
      guestEmail: 'jane@example.com',
    });
    expect(result.success).toBe(false);
  });
});
