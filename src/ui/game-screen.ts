import { BASE_LABELS } from '../core/constants.js';
import { createDigitValidator } from '../core/digits.js';
import type { GameSettings, HistoryEntry } from '../core/types.js';
import { createElement } from './dom.js';

export type RejectionReason = 'invalid' | 'duplicate' | 'finished';

/** What the app tells the screen about a submitted guess. No secret inside. */
export type GuessOutcome =
  | { readonly kind: 'rejected'; readonly reason: RejectionReason }
  | {
      readonly kind: 'accepted';
      readonly entry: HistoryEntry;
      readonly attempts: number;
      readonly won: boolean;
    };

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
export const createGameScreen = (
  settings: GameSettings,
  onGuess: (guess: string) => GuessOutcome,
): HTMLElement => {
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

    if (outcome.won) {
      input.disabled = true;
      button.disabled = true;
      message.textContent = `You guessed it in ${count(outcome.attempts, 'attempt')}!`;
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
    const outcome = onGuess(input.value);

    if (outcome.kind === 'accepted') {
      showAccepted(outcome);
      return;
    }
    message.textContent = rejectionMessage(outcome.reason, settings);
    input.focus();
  });

  return createElement(
    'section',
    { className: 'round' },
    createElement('h2', { text: 'Round in progress' }),
    createElement('p', {
      text: `Numeral system: ${BASE_LABELS[settings.base]} (base ${settings.base})`,
    }),
    createElement('p', { text: `Secret length: ${settings.length} digits` }),
    form,
    message,
    attemptsCounter,
    history.table,
  );
};
