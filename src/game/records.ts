import { MAX_RECORDS } from '../core/constants.js';
import type { GameSettings, ScoreRecord } from '../core/types.js';

const isSameGroup = (a: GameSettings, b: GameSettings): boolean =>
  a.length === b.length && a.base === b.base;

/** Fewer attempts first, then less time. Equal scores compare as 0. */
const compareScores = (a: ScoreRecord, b: ScoreRecord): number =>
  a.attempts - b.attempts || a.timeMs - b.timeMs;

export const getRecordsForSettings = (
  records: readonly ScoreRecord[],
  settings: GameSettings,
): readonly ScoreRecord[] =>
  records
    .filter((item) => isSameGroup(item, settings))
    // `filter` returned a fresh array, so sorting it does not touch the input.
    // Array.prototype.sort is stable: equal scores keep their input order.
    .sort(compareScores)
    .slice(0, MAX_RECORDS);

export const addRecord = (
  records: readonly ScoreRecord[],
  record: ScoreRecord,
): readonly ScoreRecord[] => {
  if (records.some((item) => item.id === record.id)) {
    return [...records];
  }

  const otherGroups = records.filter((item) => !isSameGroup(item, record));
  const ownGroup = getRecordsForSettings([...records, record], record);

  return [...otherGroups, ...ownGroup];
};
