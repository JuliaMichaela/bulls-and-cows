import { createDigitValidator } from './digits.js';
import type { Base } from './types.js';

export const isValidGuess = (
  guess: string,
  length: number,
  base: Base,
): boolean => {
  if (guess.length !== length) {
    return false;
  }

  const isDigit = createDigitValidator(base);
  const chars = [...guess].map((char) => char.toLowerCase());

  return chars.every(isDigit) && new Set(chars).size === chars.length;
};
