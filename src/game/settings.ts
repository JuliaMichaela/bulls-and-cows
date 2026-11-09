import { MAX_LENGTH, MIN_LENGTH } from '../core/constants.js';
import type { Base, GameSettings } from '../core/types.js';

const maxLengthFor = (base: Base): number => Math.min(MAX_LENGTH, base);

export const getAvailableLengths = (base: Base): readonly number[] =>
  Array.from(
    { length: maxLengthFor(base) - MIN_LENGTH + 1 },
    (_, index) => MIN_LENGTH + index,
  );

export const normalizeSettings = (settings: GameSettings): GameSettings => ({
  base: settings.base,
  length: Math.min(
    Math.max(settings.length, MIN_LENGTH),
    maxLengthFor(settings.base),
  ),
});
