import type { Base, GameSettings } from '../core/types.js';

export const getAvailableLengths = (_base: Base): readonly number[] => {
  throw new Error('Not implemented');
};

export const normalizeSettings = (_settings: GameSettings): GameSettings => {
  throw new Error('Not implemented');
};
