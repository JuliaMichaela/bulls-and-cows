import { memoize } from './memoize.js';

/**
 * Number of different secrets of `length` unique digits in `base`:
 * P(base, length) = base * P(base - 1, length - 1). A secret may start with 0,
 * so nothing is subtracted for a leading zero.
 *
 * The cache lives as long as the module: it is created once and shared by all
 * calls, including the recursive ones.
 */
export const countPossibleSecrets: (length: number, base: number) => number =
  memoize((length: number, base: number): number => {
    if (length === 0) {
      return 1;
    }
    if (length > base) {
      return 0;
    }
    return base * countPossibleSecrets(length - 1, base - 1);
  });
