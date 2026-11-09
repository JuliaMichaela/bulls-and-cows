import { countPossibleSecrets } from '../core/combinatorics.js';
import {
  BASE_LABELS,
  BASE_VALUES,
  MAX_LENGTH,
  MIN_LENGTH,
} from '../core/constants.js';
import type { GameSettings } from '../core/types.js';
import { getAvailableLengths, normalizeSettings } from '../game/settings.js';
import { createElement } from './dom.js';

const DEFAULT_SETTINGS: GameSettings = { length: 4, base: 10 };

/** Every length the UI can ever offer; unavailable ones are disabled. */
const ALL_LENGTHS: readonly number[] = Array.from(
  { length: MAX_LENGTH - MIN_LENGTH + 1 },
  (_, index) => MIN_LENGTH + index,
);

const createOption = (value: number, text: string): HTMLOptionElement => {
  const option = createElement('option', { text });
  option.value = String(value);
  return option;
};

const createField = (
  labelText: string,
  select: HTMLSelectElement,
): HTMLDivElement => {
  const label = createElement('label', { text: labelText });
  label.htmlFor = select.id;
  return createElement('div', { className: 'field' }, label, select);
};

/**
 * Builds the settings form once and afterwards only updates the options and
 * the text, so focus and the open select are never lost.
 */
export const createSettingsScreen = (
  onStart: (settings: GameSettings) => void,
): HTMLFormElement => {
  let settings = DEFAULT_SETTINGS;

  const baseSelect = createElement(
    'select',
    {},
    ...BASE_VALUES.map((base) =>
      createOption(base, `${BASE_LABELS[base]} (base ${base})`),
    ),
  );
  baseSelect.id = 'base-select';

  const lengthOptions = ALL_LENGTHS.map((length) =>
    createOption(length, `${length} digits`),
  );
  const lengthSelect = createElement('select', {}, ...lengthOptions);
  lengthSelect.id = 'length-select';

  const possibleSecrets = createElement('p', { className: 'possible' });
  possibleSecrets.setAttribute('aria-live', 'polite');

  const startButton = createElement('button', { text: 'Start game' });
  startButton.type = 'submit';

  const render = (): void => {
    const available = getAvailableLengths(settings.base);

    baseSelect.value = String(settings.base);
    lengthOptions.forEach((option) => {
      option.disabled = !available.includes(Number(option.value));
    });
    lengthSelect.value = String(settings.length);
    possibleSecrets.textContent = `Possible secrets: ${countPossibleSecrets(
      settings.length,
      settings.base,
    )}`;
  };

  baseSelect.addEventListener('change', () => {
    const base = BASE_VALUES.find(
      (value) => String(value) === baseSelect.value,
    );
    if (base !== undefined) {
      settings = normalizeSettings({ ...settings, base });
    }
    render();
  });

  lengthSelect.addEventListener('change', () => {
    const length = getAvailableLengths(settings.base).find(
      (value) => String(value) === lengthSelect.value,
    );
    if (length !== undefined) {
      settings = { ...settings, length };
    }
    render();
  });

  const form = createElement(
    'form',
    { className: 'settings' },
    createElement('h2', { text: 'Settings' }),
    createField('Numeral system', baseSelect),
    createField('Secret length', lengthSelect),
    possibleSecrets,
    startButton,
  );

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    onStart(settings);
  });

  render();

  return form;
};
