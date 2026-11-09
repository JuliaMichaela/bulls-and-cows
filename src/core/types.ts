import type { BASES } from './constants.js';

/** Name of a numeral system: `'bin' | 'oct' | 'dec' | 'hex'`. */
export type BaseName = keyof typeof BASES;

/** Numeric base: `2 | 8 | 10 | 16`. */
export type Base = (typeof BASES)[BaseName];

/** Settings chosen before a round starts. */
export interface GameSettings {
  readonly length: number;
  readonly base: Base;
}

/**
 * Outcome of comparing a guess with the secret. Secrets and guesses are plain
 * strings of canonical lowercase digits, so leading zeros are preserved.
 */
export interface GuessResult {
  readonly bulls: number;
  readonly cows: number;
}

/** One row of the attempt history. */
export interface HistoryEntry extends GuessResult {
  readonly guess: string;
}

export type GameStatus = 'idle' | 'playing' | 'won';

/** Immutable snapshot of a game; every update produces a new object. */
export interface GameState {
  readonly settings: GameSettings;
  readonly secret: string;
  readonly history: readonly HistoryEntry[];
  readonly status: GameStatus;
  /** Epoch milliseconds of the round start, `null` before the round starts. */
  readonly startedAt: number | null;
  /** Epoch milliseconds of the win, `null` while the round is not won. */
  readonly finishedAt: number | null;
}

/** One entry of the high-score table. */
export interface ScoreRecord extends GameSettings {
  readonly id: string;
  readonly attempts: number;
  readonly timeMs: number;
  /** Epoch milliseconds when the round was won. */
  readonly finishedAt: number;
}
