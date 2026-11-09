import { isValidGuess } from '../core/guess.js';
import { generateSecret } from '../core/secret.js';
import type { GameSettings, ScoreRecord } from '../core/types.js';
import { addRecord } from '../game/records.js';
import { startGame, submitGuess } from '../game/state.js';
import { loadRecords, saveRecords } from '../storage/records-storage.js';
import { createElement } from './dom.js';
import {
  createGameScreen,
  type GameScreen,
  type GuessOutcome,
} from './game-screen.js';
import { createRecordsView } from './records-view.js';
import { createSettingsScreen } from './settings-screen.js';

const RULES =
  'The computer picks a secret number made of unique digits. After each ' +
  'guess you get bulls (right digit in the right place) and cows (right ' +
  'digit in the wrong place). Find the number in as few attempts as you can.';

const STORAGE_NOTICE =
  'Results cannot be saved permanently in this browser. They are kept only ' +
  'until you close the page.';

interface Round {
  readonly startedAt: number;
  readonly submit: (guess: string) => GuessOutcome;
}

/** Reading `window.localStorage` itself can throw, e.g. when it is blocked. */
const getStorage = (): Storage | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

/** randomUUID exists only in secure contexts, so keep a plain fallback. */
const createRoundId = (): string =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * One round of the game. The secret and the game state live only in this
 * closure, so a finished or abandoned round can never affect the next one.
 * Randomness and the clock are used here, at the UI boundary, and passed into
 * the pure core explicitly.
 *
 * The round id is created once per round and the score is recorded only on
 * the playing -> won transition; after the win every guess is rejected, so a
 * round can never produce a second record.
 */
const createRound = (
  settings: GameSettings,
  startedAt: number,
  recordWin: (record: ScoreRecord) => readonly ScoreRecord[],
): Round => {
  const secret = generateSecret(settings.length, settings.base, Math.random);
  const roundId = createRoundId();
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
    const attempts = next.history.length;

    const won =
      current.status === 'playing' &&
      next.status === 'won' &&
      next.startedAt !== null &&
      next.finishedAt !== null
        ? { durationMs: next.finishedAt - next.startedAt, at: next.finishedAt }
        : null;

    if (won === null) {
      return {
        kind: 'accepted',
        entry,
        attempts,
        durationMs: null,
        records: null,
      };
    }

    const records = recordWin({
      id: roundId,
      length: next.settings.length,
      base: next.settings.base,
      attempts,
      timeMs: won.durationMs,
      finishedAt: won.at,
    });

    return {
      kind: 'accepted',
      entry,
      attempts,
      durationMs: won.durationMs,
      records,
    };
  };

  return { startedAt, submit };
};

export const mountApp = (container: HTMLElement): void => {
  const storage = getStorage();
  let records: readonly ScoreRecord[] =
    storage === undefined ? [] : loadRecords(storage);

  const notice = createElement('p', {
    className: 'notice',
    text: STORAGE_NOTICE,
  });
  notice.setAttribute('role', 'status');
  notice.hidden = storage !== undefined;

  const screen = createElement('div', { className: 'screen' });
  const recordsView = createRecordsView();
  let gameScreen: GameScreen | undefined;
  let chosen: GameSettings | undefined;

  // The win is kept in memory first, so the table is right even when the
  // browser refuses to store it.
  const recordWin = (record: ScoreRecord): readonly ScoreRecord[] => {
    records = addRecord(records, record);
    const saved = storage !== undefined && saveRecords(storage, records);
    if (!saved) {
      notice.hidden = false;
    }
    return records;
  };

  // The form is built once and put back on "New game", so it still holds the
  // length and base chosen for the previous round.
  const settingsForm = createSettingsScreen(
    (settings) => startRound(settings),
    (settings) => {
      chosen = settings;
      recordsView.update(records, settings);
    },
  );

  const leaveGameScreen = (): void => {
    gameScreen?.dispose();
    gameScreen = undefined;
  };

  const showSettings = (): void => {
    leaveGameScreen();
    if (chosen !== undefined) {
      recordsView.update(records, chosen);
    }
    screen.replaceChildren(settingsForm, recordsView.element);
  };

  const startRound = (settings: GameSettings): void => {
    leaveGameScreen();

    const round = createRound(settings, Date.now(), recordWin);
    gameScreen = createGameScreen({
      settings,
      startedAt: round.startedAt,
      now: Date.now,
      onGuess: round.submit,
      onNewGame: showSettings,
    });
    screen.replaceChildren(gameScreen.element);
    // `autofocus` works only once per page load, so focus explicitly.
    gameScreen.focus();
  };

  showSettings();

  container.append(
    createElement(
      'main',
      { className: 'app' },
      createElement('h1', { text: 'Bulls and Cows' }),
      createElement('p', { className: 'rules', text: RULES }),
      notice,
      screen,
    ),
  );
};
