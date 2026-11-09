import { describe, expect, it } from 'vitest';
import { evaluateGuess } from './evaluation.js';

describe('evaluateGuess', () => {
  describe('decimal secrets', () => {
    it('counts a full match as all bulls', () => {
      expect(evaluateGuess('1234', '1234')).toEqual({ bulls: 4, cows: 0 });
    });

    it('counts no common digits as zero bulls and zero cows', () => {
      expect(evaluateGuess('1234', '5678')).toEqual({ bulls: 0, cows: 0 });
    });

    it('counts all digits in the wrong places as cows', () => {
      expect(evaluateGuess('1234', '4321')).toEqual({ bulls: 0, cows: 4 });
    });

    it('counts a mix of bulls and cows', () => {
      expect(evaluateGuess('1234', '1243')).toEqual({ bulls: 2, cows: 2 });
    });

    it('counts bulls only when the other digits are absent', () => {
      expect(evaluateGuess('1234', '1564')).toEqual({ bulls: 2, cows: 0 });
    });
  });

  describe('leading zero', () => {
    it('handles a secret that starts with zero', () => {
      expect(evaluateGuess('0123', '0321')).toEqual({ bulls: 2, cows: 2 });
    });

    it('counts a zero in the wrong position as a cow', () => {
      expect(evaluateGuess('1203', '0987')).toEqual({ bulls: 0, cows: 1 });
    });
  });

  describe('hex is case-insensitive', () => {
    it('counts an upper case guess against a lower case secret', () => {
      expect(evaluateGuess('ab1f', 'AB1F')).toEqual({ bulls: 4, cows: 0 });
    });

    it('handles mixed case with swapped digits', () => {
      expect(evaluateGuess('aB1f', 'AbF1')).toEqual({ bulls: 2, cows: 2 });
    });

    it('ignores hex digits that are not in the secret', () => {
      expect(evaluateGuess('ab1f', 'cde2')).toEqual({ bulls: 0, cows: 0 });
      expect(evaluateGuess('ab1f', 'AcDf')).toEqual({ bulls: 2, cows: 0 });
    });
  });

  describe('result object', () => {
    it('is a new object with exactly two numeric fields', () => {
      const result = evaluateGuess('1234', '1243');

      expect(Object.keys(result).sort()).toEqual(['bulls', 'cows']);
      expect(typeof result.bulls).toBe('number');
      expect(typeof result.cows).toBe('number');
    });

    it('is a different object on every call', () => {
      const first = evaluateGuess('1234', '1243');
      const second = evaluateGuess('1234', '1243');

      expect(first).not.toBe(second);
    });
  });

  it('returns the same result for the same arguments', () => {
    const first = evaluateGuess('0123', '3210');
    const second = evaluateGuess('0123', '3210');

    expect(second).toEqual(first);
  });

  it('does not change its input strings', () => {
    const secret = 'aB1f';
    const guess = 'AbF1';

    evaluateGuess(secret, guess);

    expect(secret).toBe('aB1f');
    expect(guess).toBe('AbF1');
  });
});
