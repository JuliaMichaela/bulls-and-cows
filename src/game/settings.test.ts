import { describe, expect, it } from 'vitest';
import { MAX_LENGTH, MIN_LENGTH } from '../core/constants.js';
import type { GameSettings } from '../core/types.js';
import { getAvailableLengths, normalizeSettings } from './settings.js';

describe('getAvailableLengths', () => {
  it('allows only length 2 for base 2', () => {
    expect(getAvailableLengths(2)).toEqual([2]);
  });

  it('allows lengths 2 to 6 for base 8', () => {
    expect(getAvailableLengths(8)).toEqual([2, 3, 4, 5, 6]);
  });

  it('allows lengths 2 to 6 for base 10', () => {
    expect(getAvailableLengths(10)).toEqual([2, 3, 4, 5, 6]);
  });

  it('allows lengths 2 to 6 for base 16', () => {
    expect(getAvailableLengths(16)).toEqual([2, 3, 4, 5, 6]);
  });

  it('never goes outside the allowed range', () => {
    const lengths = getAvailableLengths(16);

    expect(Math.min(...lengths)).toBe(MIN_LENGTH);
    expect(Math.max(...lengths)).toBe(MAX_LENGTH);
  });

  it('returns the same values on repeated calls', () => {
    expect(getAvailableLengths(10)).toEqual(getAvailableLengths(10));
    expect(getAvailableLengths(2)).toEqual(getAvailableLengths(2));
  });
});

describe('normalizeSettings', () => {
  it('keeps valid settings unchanged', () => {
    expect(normalizeSettings({ length: 4, base: 10 })).toEqual({
      length: 4,
      base: 10,
    });
    expect(normalizeSettings({ length: 2, base: 2 })).toEqual({
      length: 2,
      base: 2,
    });
    expect(normalizeSettings({ length: 6, base: 16 })).toEqual({
      length: 6,
      base: 16,
    });
  });

  it('reduces length 6 to 2 when switching to base 2', () => {
    expect(normalizeSettings({ length: 6, base: 2 })).toEqual({
      length: 2,
      base: 2,
    });
  });

  it('raises a length below the minimum to the minimum', () => {
    expect(normalizeSettings({ length: 1, base: 10 }).length).toBe(MIN_LENGTH);
    expect(normalizeSettings({ length: 0, base: 16 }).length).toBe(MIN_LENGTH);
  });

  it.each([8, 10, 16] as const)(
    'lowers a length above the maximum to the maximum for base %i',
    (base) => {
      expect(normalizeSettings({ length: 9, base }).length).toBe(MAX_LENGTH);
    },
  );

  it.each([2, 8, 10, 16] as const)('keeps the chosen base %i', (base) => {
    expect(normalizeSettings({ length: 5, base }).base).toBe(base);
  });

  it('does not change the original object', () => {
    const original: GameSettings = { length: 6, base: 2 };

    normalizeSettings(original);

    expect(original).toEqual({ length: 6, base: 2 });
  });

  it('returns a new object even when the settings are already valid', () => {
    const original: GameSettings = { length: 4, base: 10 };

    const result = normalizeSettings(original);

    expect(result).toEqual(original);
    expect(result).not.toBe(original);
  });

  it('handles a frozen object without mutating it', () => {
    const frozen: GameSettings = Object.freeze({ length: 6, base: 2 });

    const result = normalizeSettings(frozen);

    expect(result).toEqual({ length: 2, base: 2 });
    expect(frozen).toEqual({ length: 6, base: 2 });
    expect(Object.isFrozen(frozen)).toBe(true);
  });
});
