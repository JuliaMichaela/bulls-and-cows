import { describe, expect, it } from 'vitest';
import { countPossibleSecrets } from './combinatorics.js';

describe('countPossibleSecrets', () => {
  describe('known values', () => {
    it.each([
      { length: 0, base: 10, expected: 1 },
      { length: 1, base: 10, expected: 10 },
      { length: 2, base: 2, expected: 2 },
      { length: 2, base: 8, expected: 56 },
      { length: 3, base: 8, expected: 336 },
      { length: 4, base: 10, expected: 5040 },
      { length: 6, base: 16, expected: 5765760 },
    ])(
      'returns $expected for length $length and base $base',
      ({ length, base, expected }) => {
        expect(countPossibleSecrets(length, base)).toBe(expected);
      },
    );

    it('returns 0 when the length exceeds the base', () => {
      expect(countPossibleSecrets(3, 2)).toBe(0);
    });
  });

  describe('leading zero is allowed', () => {
    it('counts every arrangement, not only those without a leading zero', () => {
      // 10 * 9 * 8 * 7 arrangements; none are excluded for starting with 0.
      expect(countPossibleSecrets(4, 10)).toBe(10 * 9 * 8 * 7);
    });
  });

  describe('repeated calls', () => {
    it('returns the same result for the same arguments', () => {
      const first = countPossibleSecrets(4, 10);
      const second = countPossibleSecrets(4, 10);
      const third = countPossibleSecrets(4, 10);

      expect(second).toBe(first);
      expect(third).toBe(first);
    });

    it('does not mix up different combinations of parameters', () => {
      expect(countPossibleSecrets(4, 10)).toBe(5040);
      expect(countPossibleSecrets(4, 8)).toBe(1680);
      expect(countPossibleSecrets(3, 10)).toBe(720);
      expect(countPossibleSecrets(10, 2)).toBe(0);
      expect(countPossibleSecrets(4, 10)).toBe(5040);
      expect(countPossibleSecrets(2, 10)).toBe(90);
    });

    it('distinguishes length from base', () => {
      expect(countPossibleSecrets(2, 8)).toBe(56);
      expect(countPossibleSecrets(8, 2)).toBe(0);
    });
  });

  describe('recurrence P(b, k) = b * P(b - 1, k - 1)', () => {
    it.each([
      { length: 1, base: 2 },
      { length: 2, base: 8 },
      { length: 3, base: 8 },
      { length: 4, base: 10 },
      { length: 5, base: 10 },
      { length: 6, base: 16 },
    ])('holds for length $length and base $base', ({ length, base }) => {
      expect(countPossibleSecrets(length, base)).toBe(
        base * countPossibleSecrets(length - 1, base - 1),
      );
    });
  });
});
