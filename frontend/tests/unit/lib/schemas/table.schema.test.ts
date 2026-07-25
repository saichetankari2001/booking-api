import { describe, it, expect } from 'vitest';
import { createTableFormSchema, updateTableFormSchema } from '../../../../src/lib/schemas/table.schema';

describe('table form schemas', () => {
  it('accepts a valid new table', () => {
    expect(
      createTableFormSchema.safeParse({ name: 'Table 4', capacity: 4, description: '' }).success,
    ).toBe(true);
  });

  it('rejects a non-positive capacity', () => {
    expect(createTableFormSchema.safeParse({ name: 'Table 4', capacity: 0 }).success).toBe(false);
  });

  it('allows a partial update', () => {
    expect(updateTableFormSchema.safeParse({ capacity: 6 }).success).toBe(true);
  });
});
