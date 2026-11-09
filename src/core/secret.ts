import { ALPHABET } from './constants.js';
import type { Base } from './types.js';

interface Pick {
  readonly available: readonly string[];
  readonly secret: string;
}

const pickDigit = ({ available, secret }: Pick, random: () => number): Pick => {
  const value = random();
  if (!(value >= 0 && value < 1)) {
    throw new RangeError('random() must return a number in [0, 1)');
  }

  const index = Math.floor(value * available.length);
  const digit = available[index];
  if (digit === undefined) {
    throw new RangeError('No digit left to pick');
  }

  return {
    available: [...available.slice(0, index), ...available.slice(index + 1)],
    secret: secret + digit,
  };
};

export const generateSecret = (
  length: number,
  base: Base,
  random: () => number = Math.random,
): string => {
  if (length < 1 || length > base) {
    throw new RangeError(`Cannot pick ${length} unique digits in base ${base}`);
  }

  const initial: Pick = { available: [...ALPHABET.slice(0, base)], secret: '' };

  return Array.from({ length }).reduce<Pick>(
    (state) => pickDigit(state, random),
    initial,
  ).secret;
};
