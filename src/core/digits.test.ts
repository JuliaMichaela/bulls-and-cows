import { describe, expect, it } from 'vitest';
import { ALPHABET, BASE_VALUES } from './constants.js';
import { createDigitValidator } from './digits.js';

describe('createDigitValidator', () => {
  it('is a curried factory: base first, then a single character', () => {
    expect(createDigitValidator(16)('a')).toBe(true);
    expect(createDigitValidator(16)('g')).toBe(false);
  });

  it('returns a predicate function for every supported base', () => {
    BASE_VALUES.forEach((base) => {
      expect(typeof createDigitValidator(base)).toBe('function');
    });
  });

  describe('base 2', () => {
    it('accepts 0 and 1', () => {
      const isDigit = createDigitValidator(2);
      expect(isDigit('0')).toBe(true);
      expect(isDigit('1')).toBe(true);
    });

    it('rejects 2, a and the empty string', () => {
      const isDigit = createDigitValidator(2);
      expect(isDigit('2')).toBe(false);
      expect(isDigit('a')).toBe(false);
      expect(isDigit('')).toBe(false);
    });
  });

  describe('base 8', () => {
    it('accepts 0 and 7', () => {
      const isDigit = createDigitValidator(8);
      expect(isDigit('0')).toBe(true);
      expect(isDigit('7')).toBe(true);
    });

    it('rejects 8 and 9', () => {
      const isDigit = createDigitValidator(8);
      expect(isDigit('8')).toBe(false);
      expect(isDigit('9')).toBe(false);
    });
  });

  describe('base 10', () => {
    it('accepts 0 and 9', () => {
      const isDigit = createDigitValidator(10);
      expect(isDigit('0')).toBe(true);
      expect(isDigit('9')).toBe(true);
    });

    it('rejects a', () => {
      expect(createDigitValidator(10)('a')).toBe(false);
    });
  });

  describe('base 16', () => {
    it('accepts 0, 9, a and f', () => {
      const isDigit = createDigitValidator(16);
      expect(isDigit('0')).toBe(true);
      expect(isDigit('9')).toBe(true);
      expect(isDigit('a')).toBe(true);
      expect(isDigit('f')).toBe(true);
    });

    it('treats upper case A and F as the same digits', () => {
      const isDigit = createDigitValidator(16);
      expect(isDigit('A')).toBe(true);
      expect(isDigit('F')).toBe(true);
    });

    it('rejects g and G', () => {
      const isDigit = createDigitValidator(16);
      expect(isDigit('g')).toBe(false);
      expect(isDigit('G')).toBe(false);
    });
  });

  describe('every base against the canonical alphabet', () => {
    it.each(BASE_VALUES)('accepts exactly the first %i characters', (base) => {
      const isDigit = createDigitValidator(base);
      const valid = [...ALPHABET.slice(0, base)];
      const invalid = [...ALPHABET.slice(base)];

      expect(valid.every(isDigit)).toBe(true);
      expect(invalid.some(isDigit)).toBe(false);
    });
  });

  describe('invalid input', () => {
    it.each(['10', 'ab', 'ff'])(
      'rejects the multi-character string %j',
      (input) => {
        expect(createDigitValidator(16)(input)).toBe(false);
      },
    );

    it.each([' ', '-', '+', '.', '_', '#', '!'])(
      'rejects the space or special character %j',
      (input) => {
        expect(createDigitValidator(16)(input)).toBe(false);
      },
    );
  });

  it('creates independent validators for different bases', () => {
    const binary = createDigitValidator(2);
    const hex = createDigitValidator(16);

    expect(binary('f')).toBe(false);
    expect(hex('f')).toBe(true);
    expect(binary('1')).toBe(true);
  });
});
