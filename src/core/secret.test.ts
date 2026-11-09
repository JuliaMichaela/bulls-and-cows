import { describe, expect, it } from 'vitest';
import { ALPHABET, BASE_VALUES } from './constants.js';
import { generateSecret } from './secret.js';
import type { Base } from './types.js';

/** Returns the given values one by one; fails loudly if asked for more. */
const sequence = (values: readonly number[]): (() => number) => {
  let index = 0;
  return () => {
    const value = values[index];
    if (value === undefined) {
      throw new Error('random sequence exhausted');
    }
    index += 1;
    return value;
  };
};

/** Wraps a random source and counts how many times it was called. */
const counting = (random: () => number) => {
  let calls = 0;
  return {
    random: () => {
      calls += 1;
      return random();
    },
    getCalls: () => calls,
  };
};

const alwaysFirst = () => 0;
const alwaysLast = () => 0.999999;

const expectValidSecret = (secret: string, length: number, base: Base) => {
  const allowed = ALPHABET.slice(0, base);

  expect(typeof secret).toBe('string');
  expect(secret).toHaveLength(length);
  expect([...secret].every((char) => allowed.includes(char))).toBe(true);
  expect(new Set(secret).size).toBe(length);
};

describe('generateSecret', () => {
  describe('result shape', () => {
    it.each([
      { length: 2, base: 2 },
      { length: 3, base: 8 },
      { length: 4, base: 10 },
      { length: 6, base: 16 },
    ] as const)(
      'returns $length unique digits of base $base',
      ({ length, base }) => {
        expectValidSecret(
          generateSecret(length, base, alwaysFirst),
          length,
          base,
        );
        expectValidSecret(
          generateSecret(length, base, alwaysLast),
          length,
          base,
        );
        expectValidSecret(
          generateSecret(
            length,
            base,
            sequence([0.3, 0.7, 0.1, 0.9, 0.5, 0.2]),
          ),
          length,
          base,
        );
      },
    );

    it('supports base 2 with length 2', () => {
      expect(generateSecret(2, 2, alwaysFirst)).toBe('01');
      expect(generateSecret(2, 2, alwaysLast)).toBe('10');
    });

    it('supports base 8', () => {
      expect(generateSecret(3, 8, alwaysFirst)).toBe('012');
      expect(generateSecret(3, 8, alwaysLast)).toBe('765');
    });

    it('supports base 10', () => {
      expect(generateSecret(4, 10, alwaysFirst)).toBe('0123');
    });

    it('supports base 16 with a lower case alphabet', () => {
      expect(generateSecret(4, 16, alwaysLast)).toBe('fedc');
      expect(generateSecret(6, 16, alwaysFirst)).toBe('012345');
    });
  });

  describe('injected random source', () => {
    it('allows a leading zero when random always returns 0', () => {
      const secret = generateSecret(4, 10, alwaysFirst);

      expect(secret).toBe('0123');
      expect(secret.startsWith('0')).toBe(true);
    });

    it('picks from the end of the remaining pool when random is near 1', () => {
      expect(generateSecret(4, 10, alwaysLast)).toBe('9876');
    });

    it('gives the same secret for the same sequence of values', () => {
      const values = [0.5, 0, 0.99, 0.2];

      expect(generateSecret(4, 10, sequence(values))).toBe(
        generateSecret(4, 10, sequence(values)),
      );
    });

    it('gives the expected, different secrets for different sequences', () => {
      expect(generateSecret(4, 10, sequence([0.5, 0, 0.99, 0.2]))).toBe('5092');
      expect(generateSecret(4, 10, sequence([0.99, 0.99, 0, 0]))).toBe('9801');
    });

    it('calls random exactly once per chosen digit', () => {
      const source = counting(alwaysFirst);

      generateSecret(5, 16, source.random);

      expect(source.getCalls()).toBe(5);
    });
  });

  describe('purity', () => {
    it('does not change the shared constants', () => {
      generateSecret(6, 16, alwaysLast);

      expect(ALPHABET).toBe('0123456789abcdef');
      expect(BASE_VALUES).toEqual([2, 8, 10, 16]);
    });

    it('is repeatable with a fresh deterministic generator', () => {
      const first = generateSecret(4, 10, sequence([0.1, 0.8, 0.4, 0.6]));
      const second = generateSecret(4, 10, sequence([0.1, 0.8, 0.4, 0.6]));

      expect(second).toBe(first);
    });
  });

  describe('default random source', () => {
    it.each([
      { length: 2, base: 2 },
      { length: 4, base: 10 },
      { length: 6, base: 16 },
    ] as const)(
      'still returns a valid secret for length $length and base $base',
      ({ length, base }) => {
        expectValidSecret(generateSecret(length, base), length, base);
      },
    );
  });
});
