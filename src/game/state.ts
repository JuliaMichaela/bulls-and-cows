import type { GameSettings, GameState } from '../core/types.js';

export const startGame = (
  _settings: GameSettings,
  _secret: string,
  _now: number,
): GameState => {
  throw new Error('Not implemented');
};

export const submitGuess = (
  _state: GameState,
  _guess: string,
  _now: number,
): GameState => {
  throw new Error('Not implemented');
};
