import { describe, it, expect } from 'vitest';
import { fetchSlots } from '../../../src/api/slots';

describe('fetchSlots', () => {
  it('returns the list of active slots', async () => {
    const slots = await fetchSlots();
    expect(slots).toHaveLength(2);
    expect(slots[0].label).toBe('Lunch 12:00');
  });
});
