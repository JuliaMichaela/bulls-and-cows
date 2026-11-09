import { BASE_LABELS } from '../core/constants.js';
import { generateSecret } from '../core/secret.js';
import type { GameSettings, GameState } from '../core/types.js';
import { startGame } from '../game/state.js';
import { createElement } from './dom.js';
import { createSettingsScreen } from './settings-screen.js';

const RULES =
  'The computer picks a secret number made of unique digits. After each ' +
  'guess you get bulls (right digit in the right place) and cows (right ' +
  'digit in the wrong place). Find the number in as few attempts as you can.';

/** Shows only the chosen settings: the secret never reaches the DOM. */
const createRoundScreen = (settings: GameSettings): HTMLElement =>
  createElement(
    'section',
    { className: 'round' },
    createElement('h2', { text: 'Round started' }),
    createElement('p', {
      text: `Numeral system: ${BASE_LABELS[settings.base]} (base ${settings.base})`,
    }),
    createElement('p', { text: `Secret length: ${settings.length} digits` }),
    createElement('p', {
      text: 'The secret number has been chosen. Settings are locked for this round.',
    }),
  );

export const mountApp = (container: HTMLElement): void => {
  const screen = createElement('div', { className: 'screen' });
  let state: GameState | undefined;

  const showRound = (): void => {
    if (state !== undefined) {
      screen.replaceChildren(createRoundScreen(state.settings));
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
