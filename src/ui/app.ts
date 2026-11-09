import { isValidGuess } from '../core/guess.js';
import { generateSecret } from '../core/secret.js';
import type { GameSettings } from '../core/types.js';
import { startGame, submitGuess } from '../game/state.js';
import { createElement } from './dom.js';
import {
  createGameScreen,
  type GameScreen,
  type GuessOutcome,
} from './game-screen.js';
import { createSettingsScreen } from './settings-screen.js';

const RULES =
  'The computer picks a secret number made of unique digits. After each ' +
  'guess you get bulls (right digit in the right place) and cows (right ' +
  'digit in the wrong place). Find the number in as few attempts as you can.';

interface Round {
  readonly startedAt: number;
  readonly submit: (guess: string) => GuessOutcome;
}

/**
 * One round of the game. The secret and the game state live only in this
 * closure, so a finished or abandoned round can never affect the next one.
 * Randomness and the clock are used here, at the UI boundary, and passed into
 * the pure core explicitly.
 */
const createRound = (settings: GameSettings, startedAt: number): Round => {
  const secret = generateSecret(settings.length, settings.base, Math.random);
  let state = startGame(settings, secret, startedAt);

  const submit = (guess: string): GuessOutcome => {
    const current = state;
    const next = submitGuess(current, guess, Date.now());

    if (next === current) {
      if (current.status !== 'playing') {
        return { kind: 'rejected', reason: 'finished' };
      }
      const reason = isValidGuess(guess, settings.length, settings.base)
        ? 'duplicate'
        : 'invalid';
      return { kind: 'rejected', reason };
    }

    const entry = next.history.at(-1);
    if (entry === undefined) {
      return { kind: 'rejected', reason: 'invalid' };
    }

    state = next;

    // The duration comes strictly from the state: finishedAt - startedAt.
    const durationMs =
      next.status === 'won' &&
      next.startedAt !== null &&
      next.finishedAt !== null
        ? next.finishedAt - next.startedAt
        : null;

    return {
      kind: 'accepted',
      entry,
      attempts: next.history.length,
      durationMs,
    };
  };

  return { startedAt, submit };
};

export const mountApp = (container: HTMLElement): void => {
  const screen = createElement('div', { className: 'screen' });
  let gameScreen: GameScreen | undefined;

  // The form is built once and put back on "New game", so it still holds the
  // length and base chosen for the previous round.
  const settingsForm = createSettingsScreen((settings) => startRound(settings));

  const leaveGameScreen = (): void => {
    gameScreen?.dispose();
    gameScreen = undefined;
  };

  const showSettings = (): void => {
    leaveGameScreen();
    screen.replaceChildren(settingsForm);
  };

  const startRound = (settings: GameSettings): void => {
    leaveGameScreen();

    const round = createRound(settings, Date.now());
    gameScreen = createGameScreen({
      settings,
      startedAt: round.startedAt,
      now: Date.now,
      onGuess: round.submit,
      onNewGame: showSettings,
    });
    screen.replaceChildren(gameScreen.element);
  };

  showSettings();

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
