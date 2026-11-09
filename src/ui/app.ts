import { isValidGuess } from '../core/guess.js';
import { generateSecret } from '../core/secret.js';
import type { GameSettings, GameState } from '../core/types.js';
import { startGame, submitGuess } from '../game/state.js';
import { createElement } from './dom.js';
import { createGameScreen, type GuessOutcome } from './game-screen.js';
import { createSettingsScreen } from './settings-screen.js';

const RULES =
  'The computer picks a secret number made of unique digits. After each ' +
  'guess you get bulls (right digit in the right place) and cows (right ' +
  'digit in the wrong place). Find the number in as few attempts as you can.';

export const mountApp = (container: HTMLElement): void => {
  const screen = createElement('div', { className: 'screen' });
  let state: GameState | undefined;

  // The screen reports guesses through this callback; the secret and the
  // game state never leave this closure.
  const handleGuess = (guess: string): GuessOutcome => {
    const current = state;
    if (current === undefined) {
      return { kind: 'rejected', reason: 'finished' };
    }

    const next = submitGuess(current, guess, Date.now());
    if (next === current) {
      const { length, base } = current.settings;
      if (current.status !== 'playing') {
        return { kind: 'rejected', reason: 'finished' };
      }
      return {
        kind: 'rejected',
        reason: isValidGuess(guess, length, base) ? 'duplicate' : 'invalid',
      };
    }

    const entry = next.history.at(-1);
    if (entry === undefined) {
      return { kind: 'rejected', reason: 'invalid' };
    }

    state = next;
    return {
      kind: 'accepted',
      entry,
      attempts: next.history.length,
      won: next.status === 'won',
    };
  };

  const showRound = (): void => {
    if (state !== undefined) {
      screen.replaceChildren(createGameScreen(state.settings, handleGuess));
    }
  };

  // Randomness and the clock are used here, at the UI boundary, and passed
  // into the pure core explicitly.
  const startRound = (settings: GameSettings): void => {
    const secret = generateSecret(settings.length, settings.base, Math.random);
    state = startGame(settings, secret, Date.now());
    showRound();
  };

  screen.append(createSettingsScreen(startRound));

  container.append(
    createElement(
      'main',
      { className: 'app' },
      createElement('h1', { text: 'Bulls and Cows' }),
      createElement('p', { className: 'rules', text: RULES }),
      screen,
    ),
  );
};
