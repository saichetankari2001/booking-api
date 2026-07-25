import { describe, it, expect } from 'vitest';
import { formatDate } from '../../../src/lib/dateUtils';

describe('formatDate', () => {
  it('formats a full ISO timestamp as a readable date', () => {
    expect(formatDate('2026-08-15T00:00:00.000Z')).toBe('August 15, 2026');
  });

  it('formats a plain YYYY-MM-DD string the same way', () => {
    expect(formatDate('2026-01-05')).toBe('January 5, 2026');
  });
});
