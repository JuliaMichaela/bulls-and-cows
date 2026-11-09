import type { Base } from './types.js';

export const generateSecret = (
  _length: number,
  _base: Base,
  _random: () => number = Math.random,
): string => {
  throw new Error('Not implemented');
};
