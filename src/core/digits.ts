import { ALPHABET } from './constants.js';
import type { Base } from './types.js';

export const createDigitValidator = (
  base: Base,
): ((char: string) => boolean) => {
  const digits = ALPHABET.slice(0, base);

  return (char) => char.length === 1 && digits.includes(char.toLowerCase());
};
