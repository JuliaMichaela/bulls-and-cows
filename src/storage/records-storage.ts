import type { ScoreRecord } from '../core/types.js';

export const loadRecords = (
  _storage: Pick<Storage, 'getItem'>,
): readonly ScoreRecord[] => {
  throw new Error('Not implemented');
};

export const saveRecords = (
  _storage: Pick<Storage, 'setItem'>,
  _records: readonly ScoreRecord[],
): boolean => {
  throw new Error('Not implemented');
};
