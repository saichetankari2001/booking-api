import { describe, it, expect } from 'vitest';
import {
  createSlotFormSchema,
  updateSlotFormSchema,
} from '../../../../src/lib/schemas/slot.schema';

describe('slot form schemas', () => {
  it('accepts a valid new slot', () => {
    expect(
      createSlotFormSchema.safeParse({
        label: 'Lunch 12:00',
        startTime: '12:00',
        durationMinutes: 90,
        isActive: true,
      }).success,
    ).toBe(true);
  });

  it('rejects a malformed startTime', () => {
    expect(
      createSlotFormSchema.safeParse({ label: 'Lunch', startTime: '12pm', durationMinutes: 90 })
        .success,
    ).toBe(false);
  });

  it('allows a partial update', () => {
    expect(updateSlotFormSchema.safeParse({ isActive: false }).success).toBe(true);
  });
});
