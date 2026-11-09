import type { GameSettings, ScoreRecord } from '../core/types.js';

export const getRecordsForSettings = (
  _records: readonly ScoreRecord[],
  _settings: GameSettings,
): readonly ScoreRecord[] => {
  throw new Error('Not implemented');
};

export const addRecord = (
  _records: readonly ScoreRecord[],
  _record: ScoreRecord,
): readonly ScoreRecord[] => {
  throw new Error('Not implemented');
};
