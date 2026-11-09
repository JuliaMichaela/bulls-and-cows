import { BASE_LABELS } from '../core/constants.js';
import { createDigitValidator } from '../core/digits.js';
import type { GameSettings, HistoryEntry } from '../core/types.js';
import { createElement } from './dom.js';
import { formatDuration, startTicker } from './timer.js';

const TICK_MS = 250;

export type RejectionReason = 'invalid' | 'duplicate' | 'finished';

/** What the app tells the screen about a submitted guess. No secret inside. */
export type GuessOutcome =
  | { readonly kind: 'rejected'; readonly reason: RejectionReason }
  | {
      readonly kind: 'accepted';
      readonly entry: HistoryEntry;
      readonly attempts: number;
      /** Set only when this guess won the round: finishedAt - startedAt. */
      readonly durationMs: number | null;
    };

export interface GameScreenOptions {
  readonly settings: GameSettings;
  /** Epoch milliseconds of the round start; the shown time derives from it. */
  readonly startedAt: number;
  readonly now: () => number;
  readonly onGuess: (guess: string) => GuessOutcome;
  readonly onNewGame: () => void;
}

export interface GameScreen {
  readonly element: HTMLElement;
  /** Stops the timer. Must be called when the screen is left. */
  readonly dispose: () => void;
}

const count = (amount: number, word: string): string =>
  `${amount} ${word}${amount === 1 ? '' : 's'}`;

const rejectionMessage = (
  reason: RejectionReason,
  settings: GameSettings,
): string => {
  switch (reason) {
    case 'invalid':
      return (
        `Enter exactly ${settings.length} different ` +
        `${BASE_LABELS[settings.base].toLowerCase()} digits.`
      );
    case 'duplicate':
      return 'You have already tried this guess.';
    case 'finished':
      return 'This round is over.';
  }
};

const createHistoryRow = (
  entry: HistoryEntry,
  attempt: number,
): HTMLTableRowElement =>
  createElement(
    'tr',
    {},
    createElement('td', { text: String(attempt) }),
    createElement('td', { className: 'guess', text: entry.guess }),
    createElement('td', { text: String(entry.bulls) }),
    createElement('td', { text: String(entry.cows) }),
  );

const createHistoryTable = (): {
  readonly table: HTMLTableElement;
  readonly body: HTMLTableSectionElement;
} => {
  const headers = ['#', 'Guess', 'Bulls', 'Cows'].map((title) => {
    const cell = createElement('th', { text: title });
    cell.scope = 'col';
    return cell;
  });
  const body = createElement('tbody');
  const table = createElement(
    'table',
    { className: 'history' },
    createElement('thead', {}, createElement('tr', {}, ...headers)),
    body,
  );
  table.hidden = true;

  return { table, body };
};

/**
 * The round screen. It only knows the settings and a callback: the secret
 * stays inside the app, so it can never leak into the DOM from here.
 */
export const createGameScreen = ({
  settings,
  startedAt,
  now,
  onGuess,
  onNewGame,
}: GameScreenOptions): GameScreen => {
  const isDigit = createDigitValidator(settings.base);
  const keepDigits = (text: string): string =>
    [...text].filter(isDigit).join('');

  const input = createElement('input');
  input.id = 'guess-input';
  input.type = 'text';
  input.maxLength = settings.length;
  input.autocomplete = 'off';
  input.autocapitalize = 'off';
  input.spellcheck = false;
  input.autofocus = true;
  input.inputMode = settings.base <= 10 ? 'numeric' : 'text';

  const label = createElement('label', { text: 'Your guess' });
  label.htmlFor = input.id;

  const button = createElement('button', { text: 'Guess' });
  button.type = 'submit';

  const message = createElement('p', { className: 'message' });
  message.setAttribute('aria-live', 'polite');

  const attemptsCounter = createElement('p', {
    className: 'attempts',
    text: 'Attempts: 0',
  });
  const history = createHistoryTable();

  const timerValue = createElement('span', { text: formatDuration(0) });
  const timer = createElement(
    'p',
    { className: 'timer', text: 'Time: ' },
    timerValue,
  );

  const newGameButton = createElement('button', { text: 'New game' });
  newGameButton.type = 'button';
  newGameButton.addEventListener('click', onNewGame);

  // Only the text of the timer is updated; the form and the history stay.
  let finished = false;
  const stopTicker = startTicker(() => {
    timerValue.textContent = formatDuration(now() - startedAt);
  }, TICK_MS);

  // Drop every character that is not a digit of the chosen base, including
  // pasted text, and keep the caret next to the characters that stayed.
  input.addEventListener('input', () => {
    const value = input.value;
    const kept = keepDigits(value);
    if (kept === value) {
      return;
    }
    const caret = input.selectionStart ?? value.length;
    const caretAfter = keepDigits(value.slice(0, caret)).length;
    input.value = kept;
    input.setSelectionRange(caretAfter, caretAfter);
  });

  // Filter before insertion too (typing, paste, drop, autofill): the browser
  // would otherwise cut the inserted text to maxlength first and could lose
  // valid digits that follow an invalid one.
  input.addEventListener('beforeinput', (event) => {
    const inserted = event.data ?? event.dataTransfer?.getData('text');
    if (
      !event.inputType.startsWith('insert') ||
      event.isComposing ||
      !event.cancelable ||
      inserted === undefined ||
      inserted === null
    ) {
      return;
    }

    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const room = Math.max(
      0,
      settings.length - (input.value.length - (end - start)),
    );
    const accepted = keepDigits(inserted).slice(0, room);
    if (accepted === inserted) {
      return;
    }

    event.preventDefault();
    input.setRangeText(accepted, start, end, 'end');
  });

  const showAccepted = (outcome: GuessOutcome & { kind: 'accepted' }): void => {
    history.body.append(createHistoryRow(outcome.entry, outcome.attempts));
    history.table.hidden = false;
    attemptsCounter.textContent = `Attempts: ${outcome.attempts}`;

    if (outcome.durationMs !== null) {
      finished = true;
      stopTicker();
      timerValue.textContent = formatDuration(outcome.durationMs);
      input.disabled = true;
      button.disabled = true;
      message.textContent =
        `You guessed it in ${count(outcome.attempts, 'attempt')} ` +
        `and ${formatDuration(outcome.durationMs)}!`;
      return;
    }

    message.textContent =
      `Guess accepted: ${count(outcome.entry.bulls, 'bull')}, ` +
      `${count(outcome.entry.cows, 'cow')}.`;
    input.value = '';
    input.focus();
  };

  const form = createElement(
    'form',
    { className: 'guess-form' },
    createElement('div', { className: 'field' }, label, input),
    button,
  );

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (finished) {
      return;
    }
    const outcome = onGuess(input.value);

    if (outcome.kind === 'accepted') {
      showAccepted(outcome);
      return;
    }
    message.textContent = rejectionMessage(outcome.reason, settings);
    input.focus();
  });

  const element = createElement(
    'section',
    { className: 'round' },
    createElement('h2', { text: 'Round in progress' }),
    createElement('p', {
      text: `Numeral system: ${BASE_LABELS[settings.base]} (base ${settings.base})`,
    }),
    createElement('p', { text: `Secret length: ${settings.length} digits` }),
    timer,
    form,
    message,
    attemptsCounter,
    history.table,
    newGameButton,
  );

  return { element, dispose: stopTicker };
};
