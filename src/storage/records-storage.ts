import {
  BASE_VALUES,
  MAX_LENGTH,
  MIN_LENGTH,
  RECORDS_STORAGE_KEY,
} from '../core/constants.js';
import type { Base, ScoreRecord } from '../core/types.js';
import { addRecord } from '../game/records.js';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isBase = (value: unknown): value is Base =>
  BASE_VALUES.some((base) => base === value);

const isValidLength = (value: unknown, base: Base): boolean =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= MIN_LENGTH &&
  value <= Math.min(MAX_LENGTH, base);

const isPositiveSafeInteger = (value: unknown): boolean =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

const isNonNegativeFinite = (value: unknown): boolean =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const isScoreRecord = (value: unknown): value is ScoreRecord => {
  if (!isPlainObject(value)) {
    return false;
  }

  const { id, length, base, attempts, timeMs, finishedAt } = value;

  return (
    typeof id === 'string' &&
    id.length > 0 &&
    isBase(base) &&
    isValidLength(length, base) &&
    isPositiveSafeInteger(attempts) &&
    isNonNegativeFinite(timeMs) &&
    isNonNegativeFinite(finishedAt)
  );
};

/** Keeps only the known fields, so unexpected extra data is not carried over. */
const pickFields = (item: ScoreRecord): ScoreRecord => ({
  id: item.id,
  length: item.length,
  base: item.base,
  attempts: item.attempts,
  timeMs: item.timeMs,
  finishedAt: item.finishedAt,
});

/** Keeps the first record of every id. Must run before the top-N limit. */
const keepFirstOfEachId = (
  records: readonly ScoreRecord[],
): readonly ScoreRecord[] => {
  const seen = new Set<string>();

  return records.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
};

const readRaw = (storage: Pick<Storage, 'getItem'>): string | null => {
  try {
    return storage.getItem(RECORDS_STORAGE_KEY);
  } catch {
    return null;
  }
};

const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

export const loadRecords = (
  storage: Pick<Storage, 'getItem'>,
): readonly ScoreRecord[] => {
  const raw = readRaw(storage);
  if (raw === null) {
    return [];
  }

  const parsed = parseJson(raw);
  if (!Array.isArray(parsed)) {
    return [];
  }

  const items: readonly unknown[] = parsed;
  const valid = keepFirstOfEachId(items.filter(isScoreRecord).map(pickFields));

  return valid.reduce<readonly ScoreRecord[]>(
    (table, item) => addRecord(table, item),
    [],
  );
};

export const saveRecords = (
  storage: Pick<Storage, 'setItem'>,
  records: readonly ScoreRecord[],
): boolean => {
  try {
    storage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
};
