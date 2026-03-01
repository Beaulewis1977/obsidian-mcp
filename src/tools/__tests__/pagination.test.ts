import { describe, it, expect } from 'vitest';
import { paginate, encodeCursor, decodeCursor, PAGE_SIZE } from '../pagination.js';

describe('pagination', () => {
  const items100 = Array.from({ length: 100 }, (_, i) => i + 1);

  describe('paginate()', () => {
    it('Test 1: returns first page and nextCursor for 100-item array', () => {
      const result = paginate(items100);
      expect(result.page).toHaveLength(PAGE_SIZE);
      expect(result.page[0]).toBe(1);
      expect(result.page[PAGE_SIZE - 1]).toBe(PAGE_SIZE);
      expect(result.nextCursor).toBeDefined();
    });

    it('Test 2: second page using nextCursor returns items 50-99 and no nextCursor', () => {
      const first = paginate(items100);
      const second = paginate(items100, first.nextCursor);
      expect(second.page).toHaveLength(50);
      expect(second.page[0]).toBe(51);
      expect(second.page[49]).toBe(100);
      expect(second.nextCursor).toBeUndefined();
    });

    it('Test 3: array <= pageSize returns all items, nextCursor undefined', () => {
      const items10 = Array.from({ length: 10 }, (_, i) => i + 1);
      const result = paginate(items10);
      expect(result.page).toHaveLength(10);
      expect(result.nextCursor).toBeUndefined();
    });

    it('Test 4: empty array returns empty page, nextCursor undefined', () => {
      const result = paginate([], undefined);
      expect(result.page).toHaveLength(0);
      expect(result.nextCursor).toBeUndefined();
    });

    it('Test 6: malformed cursor treats offset as 0 (falls back to first page)', () => {
      const result = paginate(items100, 'malformed_cursor');
      expect(result.page).toHaveLength(PAGE_SIZE);
      expect(result.page[0]).toBe(1);
    });
  });

  describe('decodeCursor()', () => {
    it('Test 5: invalid base64 garbage returns null (no throw)', () => {
      expect(decodeCursor('invalid_base64_garbage')).toBeNull();
    });
  });

  describe('encodeCursor / decodeCursor roundtrip', () => {
    it('encodes and decodes an offset correctly', () => {
      const encoded = encodeCursor(42);
      const decoded = decodeCursor(encoded);
      expect(decoded).toBe(42);
    });
  });
});
