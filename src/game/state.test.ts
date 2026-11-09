import { describe, expect, it } from 'vitest';
import { evaluateGuess } from '../core/evaluation.js';
import type { GameSettings, GameState, HistoryEntry } from '../core/types.js';
import { startGame, submitGuess } from './state.js';

const START = 1000;
const NOW = 5000;
const LATER = 9000;

const deepFreeze = <T extends object>(value: T): T => {
  Object.values(value).forEach((child: unknown) => {
    if (typeof child === 'object' && child !== null) {
      deepFreeze(child);
    }
  });
  return Object.freeze(value);
};

/** Builds a deeply frozen playing state directly, without startGame. */
const createState = (overrides: Partial<GameState> = {}): GameState => {
  const state: GameState = {
    settings: { length: 4, base: 10 },
    secret: '0123',
    history: [],
    status: 'playing',
    startedAt: START,
    finishedAt: null,
    ...overrides,
  };
  return deepFreeze(state);
};

const createHexState = (overrides: Partial<GameState> = {}): GameState =>
  createState({
    settings: { length: 4, base: 16 },
    secret: 'ab1f',
    ...overrides,
  });

const entry = (guess: string, secret: string): HistoryEntry => ({
  guess,
  ...evaluateGuess(secret, guess),
});

const duration = (state: GameState): number | null =>
  state.startedAt === null || state.finishedAt === null
    ? null
    : state.finishedAt - state.startedAt;

describe('startGame', () => {
  it('starts a round in the playing status', () => {
    const state = startGame({ length: 4, base: 10 }, '0123', START);

    expect(state.status).toBe('playing');
  });

  it('copies the settings instead of referencing the original object', () => {
    const settings: GameSettings = { length: 4, base: 10 };

    const state = startGame(settings, '0123', START);

    expect(state.settings).toEqual({ length: 4, base: 10 });
    expect(state.settings).not.toBe(settings);
  });

  it('stores the secret in lower case', () => {
    const state = startGame({ length: 4, base: 16 }, 'aB1F', START);

    expect(state.secret).toBe('ab1f');
  });

  it('keeps the leading zero of the secret', () => {
    const state = startGame({ length: 4, base: 10 }, '0123', START);

    expect(state.secret).toBe('0123');
  });

  it('starts with an empty history', () => {
    const state = startGame({ length: 4, base: 10 }, '0123', START);

    expect(state.history).toEqual([]);
  });

  it('records the passed time as startedAt and leaves finishedAt null', () => {
    const state = startGame({ length: 4, base: 10 }, '0123', START);

    expect(state.startedAt).toBe(START);
    expect(state.finishedAt).toBeNull();
  });

  it('does not change the original settings', () => {
    const settings: GameSettings = Object.freeze({ length: 4, base: 10 });

    startGame(settings, '0123', START);

    expect(settings).toEqual({ length: 4, base: 10 });
  });

  it('creates independent states and history arrays on every start', () => {
    const first = startGame({ length: 4, base: 10 }, '0123', START);
    const second = startGame({ length: 4, base: 10 }, '0123', START);

    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second.history).not.toBe(first.history);
    expect(second.settings).not.toBe(first.settings);
  });
});

describe('submitGuess', () => {
  describe('a valid guess', () => {
    it('adds exactly one history entry', () => {
      const next = submitGuess(createState(), '0132', NOW);

      expect(next.history).toHaveLength(1);
    });

    it('records the guess with correct bulls and cows', () => {
      const next = submitGuess(createState(), '0132', NOW);

      expect(next.history).toEqual([{ guess: '0132', bulls: 2, cows: 2 }]);
    });

    it('matches the evaluateGuess contract', () => {
      const next = submitGuess(createState(), '1023', NOW);

      expect(next.history).toEqual([entry('1023', '0123')]);
    });

    it('stores the normalized (lower case) guess', () => {
      const next = submitGuess(createHexState(), 'AbF1', NOW);

      expect(next.history).toEqual([
        { guess: 'abf1', ...evaluateGuess('ab1f', 'abf1') },
      ]);
      expect(next.history[0]?.guess).toBe('abf1');
    });

    it('creates a new state object and a new history array', () => {
      const state = createState();

      const next = submitGuess(state, '0132', NOW);

      expect(next).not.toBe(state);
      expect(next.history).not.toBe(state.history);
    });
  });

  describe('immutability', () => {
    it('does not change the original state, history or old entries', () => {
      const old = [entry('0132', '0123'), entry('1023', '0123')];
      const state = createState({ history: old });
      const snapshot = structuredClone(state);

      const next = submitGuess(state, '4567', NOW);

      expect(state).toEqual(snapshot);
      expect(state.history).toHaveLength(2);
      expect(next.history).toHaveLength(3);
    });

    it('keeps the old entries in order with the same values', () => {
      const old = [entry('0132', '0123'), entry('1023', '0123')];
      const state = createState({ history: old });

      const next = submitGuess(state, '4567', NOW);

      expect(next.history.slice(0, 2)).toEqual(old);
      expect(next.history[2]?.guess).toBe('4567');
    });

    it('processes a deeply frozen state without mutating it', () => {
      const state = createState({ history: [entry('0132', '0123')] });

      // Mutating a frozen object throws a TypeError, so reaching the
      // assertions below means nothing was mutated.
      const next = submitGuess(state, '4567', NOW);
      const won = submitGuess(state, '0123', NOW);

      expect(next.history).toHaveLength(2);
      expect(won.status).toBe('won');
      expect(Object.isFrozen(state.history)).toBe(true);
      expect(state.history).toHaveLength(1);
    });
  });

  describe('several guesses in a row', () => {
    it('appends every guess in order', () => {
      const guesses = ['0132', '1023', '4567'];

      const final = guesses.reduce(
        (state, guess) => submitGuess(state, guess, NOW),
        createState(),
      );

      expect(final.history.map((item) => item.guess)).toEqual(guesses);
      expect(final.history).toEqual(guesses.map((g) => entry(g, '0123')));
      expect(final.status).toBe('playing');
    });
  });

  describe('a guess that is not accepted', () => {
    it.each(['012', '01234', '', 'abcd', '0012', ' 012', '01 2'])(
      'returns the original state for the invalid guess %j',
      (guess) => {
        const state = createState();

        const next = submitGuess(state, guess, NOW);

        expect(next).toBe(state);
        expect(next.history).toHaveLength(0);
      },
    );

    it('returns the original state for a repeated guess', () => {
      const first = submitGuess(createState(), '0132', NOW);

      const again = submitGuess(first, '0132', LATER);

      expect(again).toBe(first);
      expect(again.history).toHaveLength(1);
    });

    it('treats a hex repeat in another case as the same guess', () => {
      const first = submitGuess(createHexState(), 'AbF1', NOW);

      expect(submitGuess(first, 'abf1', LATER)).toBe(first);
      expect(submitGuess(first, 'ABF1', LATER)).toBe(first);
      expect(first.history).toHaveLength(1);
    });
  });

  describe('a wrong guess', () => {
    it('keeps the round playing without a finish time', () => {
      const next = submitGuess(createState(), '0132', NOW);

      expect(next.status).toBe('playing');
      expect(next.finishedAt).toBeNull();
    });
  });

  describe('the winning guess', () => {
    it('is added to the history and sets the won status', () => {
      const next = submitGuess(createState(), '0123', NOW);

      expect(next.status).toBe('won');
      expect(next.history).toEqual([{ guess: '0123', bulls: 4, cows: 0 }]);
    });

    it('wins with a hex guess in another case', () => {
      const next = submitGuess(createHexState(), 'AB1F', NOW);

      expect(next.status).toBe('won');
      expect(next.history[0]?.guess).toBe('ab1f');
    });

    it('sets finishedAt to the passed time and keeps startedAt', () => {
      const next = submitGuess(createState(), '0123', NOW);

      expect(next.finishedAt).toBe(NOW);
      expect(next.startedAt).toBe(START);
    });

    it('counts attempts as the history length, winning guess included', () => {
      const final = ['0132', '1023', '0123'].reduce(
        (state, guess) => submitGuess(state, guess, NOW),
        createState(),
      );

      expect(final.history).toHaveLength(3);
      expect(final.status).toBe('won');
    });

    it('lets the duration be read as finishedAt - startedAt', () => {
      const next = submitGuess(createState(), '0123', NOW);

      expect(duration(next)).toBe(NOW - START);
    });
  });

  describe('a round that is not being played', () => {
    it('ignores guesses after the win and keeps the win time', () => {
      const won = submitGuess(createState(), '0123', NOW);

      expect(submitGuess(won, '0132', LATER)).toBe(won);
      expect(submitGuess(won, '0123', LATER)).toBe(won);
      expect(won.finishedAt).toBe(NOW);
      expect(won.history).toHaveLength(1);
    });

    it('ignores guesses in the idle status', () => {
      const idle = createState({ status: 'idle', startedAt: null });

      const next = submitGuess(idle, '0132', NOW);

      expect(next).toBe(idle);
      expect(next.history).toHaveLength(0);
    });
  });
});
