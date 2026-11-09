import { describe, expect, it } from 'vitest';
import { isValidGuess } from './guess.js';

describe('isValidGuess', () => {
  describe('accepts a correct guess', () => {
    it('in base 2', () => {
      expect(isValidGuess('01', 2, 2)).toBe(true);
    });

    it('in base 8', () => {
      expect(isValidGuess('072', 3, 8)).toBe(true);
    });

    it('in base 10', () => {
      expect(isValidGuess('0123', 4, 10)).toBe(true);
    });

    it('in base 16', () => {
      expect(isValidGuess('0aF9', 4, 16)).toBe(true);
    });

    it('with a leading zero', () => {
      expect(isValidGuess('0123', 4, 10)).toBe(true);
      expect(isValidGuess('01', 2, 2)).toBe(true);
    });
  });

  describe('requires the exact length', () => {
    it('rejects a guess shorter than length', () => {
      expect(isValidGuess('123', 4, 10)).toBe(false);
    });

    it('rejects a guess longer than length', () => {
      expect(isValidGuess('12345', 4, 10)).toBe(false);
    });

    it('rejects the empty string', () => {
      expect(isValidGuess('', 2, 10)).toBe(false);
    });
  });

  describe('requires every character to belong to the base', () => {
    it('rejects 2 in base 2', () => {
      expect(isValidGuess('012', 3, 2)).toBe(false);
    });

    it('rejects 8 in base 8', () => {
      expect(isValidGuess('078', 3, 8)).toBe(false);
    });

    it('rejects a in base 10', () => {
      expect(isValidGuess('12a', 3, 10)).toBe(false);
    });

    it('rejects g in base 16', () => {
      expect(isValidGuess('12g', 3, 16)).toBe(false);
    });
  });

  describe('forbids repeated digits', () => {
    it.each(['0012', '1223'])('rejects %j in base 10', (guess) => {
      expect(isValidGuess(guess, 4, 10)).toBe(false);
    });

    it('rejects aabf in base 16', () => {
      expect(isValidGuess('aabf', 4, 16)).toBe(false);
    });

    it.each(['aA12', 'fF09'])(
      'treats upper and lower case hex as the same digit: %j',
      (guess) => {
        expect(isValidGuess(guess, 4, 16)).toBe(false);
      },
    );
  });

  it('accepts different hex digits written in different case', () => {
    expect(isValidGuess('aB09', 4, 16)).toBe(true);
  });

  describe('rejects spaces and special characters', () => {
    it.each(['1 2', '1-2', '1.2', '12!', '+12', '1_2'])(
      'rejects %j',
      (guess) => {
        expect(isValidGuess(guess, 3, 10)).toBe(false);
      },
    );
  });

  describe('does not trim the guess', () => {
    it('rejects a leading space', () => {
      expect(isValidGuess(' 012', 3, 10)).toBe(false);
    });

    it('rejects a trailing space', () => {
      expect(isValidGuess('012 ', 3, 10)).toBe(false);
    });

    it('rejects an inner space', () => {
      expect(isValidGuess('01 2', 3, 10)).toBe(false);
    });
  });
});
