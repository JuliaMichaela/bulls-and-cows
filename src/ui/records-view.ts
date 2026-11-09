import { BASE_LABELS } from '../core/constants.js';
import type { GameSettings, ScoreRecord } from '../core/types.js';
import { getRecordsForSettings } from '../game/records.js';
import { createElement } from './dom.js';
import { formatDuration } from './timer.js';

export interface RecordsView {
  readonly element: HTMLElement;
  /** Shows the best results of one length/base group; only rows are rebuilt. */
  readonly update: (
    records: readonly ScoreRecord[],
    settings: GameSettings,
  ) => void;
}

const createRow = (record: ScoreRecord, place: number): HTMLTableRowElement =>
  createElement(
    'tr',
    {},
    createElement('td', { text: String(place) }),
    createElement('td', { text: String(record.attempts) }),
    createElement('td', { text: formatDuration(record.timeMs) }),
  );

export const createRecordsView = (): RecordsView => {
  const group = createElement('p', { className: 'records-group' });
  const emptyMessage = createElement('p', {
    className: 'records-empty',
    text: 'No results yet for these settings. Win a round to set the first record.',
  });

  const headers = ['Place', 'Attempts', 'Time'].map((title) => {
    const cell = createElement('th', { text: title });
    cell.scope = 'col';
    return cell;
  });
  const body = createElement('tbody');
  const table = createElement(
    'table',
    { className: 'records' },
    createElement('caption', {
      className: 'visually-hidden',
      text: 'Best results',
    }),
    createElement('thead', {}, createElement('tr', {}, ...headers)),
    body,
  );

  const element = createElement(
    'section',
    { className: 'records-view' },
    createElement('h2', { text: 'Best results' }),
    group,
    emptyMessage,
    table,
  );

  const update = (
    records: readonly ScoreRecord[],
    settings: GameSettings,
  ): void => {
    const best = getRecordsForSettings(records, settings);

    group.textContent =
      `${BASE_LABELS[settings.base]} (base ${settings.base}), ` +
      `${settings.length} digits`;
    body.replaceChildren(
      ...best.map((record, index) => createRow(record, index + 1)),
    );
    table.hidden = best.length === 0;
    emptyMessage.hidden = best.length > 0;
  };

  return { element, update };
};
