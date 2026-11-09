import { evaluateGuess } from '../core/evaluation.js';
import { isValidGuess } from '../core/guess.js';
import type { GameSettings, GameState, HistoryEntry } from '../core/types.js';

export const startGame = (
  settings: GameSettings,
  secret: string,
  now: number,
): GameState => ({
  settings: { ...settings },
  secret: secret.toLowerCase(),
  history: [],
  status: 'playing',
  startedAt: now,
  finishedAt: null,
});

export const submitGuess = (
  state: GameState,
  guess: string,
  now: number,
): GameState => {
  const { settings, secret, history } = state;

  if (state.status !== 'playing') {
    return state;
  }
  if (!isValidGuess(guess, settings.length, settings.base)) {
    return state;
  }

  const normalized = guess.toLowerCase();
  if (history.some((item) => item.guess.toLowerCase() === normalized)) {
    return state;
  }

  const result = evaluateGuess(secret, normalized);
  const entry: HistoryEntry = { guess: normalized, ...result };
  const isWon = result.bulls === settings.length;

  return {
    ...state,
    history: [...history, entry],
    status: isWon ? 'won' : 'playing',
    finishedAt: isWon ? now : null,
  };
};
