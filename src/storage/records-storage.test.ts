import { describe, expect, it, vi } from 'vitest';
import { MAX_RECORDS, RECORDS_STORAGE_KEY } from '../core/constants.js';
import type { ScoreRecord } from '../core/types.js';
import { loadRecords, saveRecords } from './records-storage.js';

const FINISHED_AT = 1_700_000_000_000;

const deepFreeze = <T extends object>(value: T): T => {
  Object.values(value).forEach((child: unknown) => {
    if (typeof child === 'object' && child !== null) {
      deepFreeze(child);
    }
  });
  return Object.freeze(value);
};

const record = (
  id: string,
  attempts = 5,
  timeMs = 4000,
  group: { length?: number; base?: 2 | 8 | 10 | 16 } = {},
): ScoreRecord => ({
  id,
  length: group.length ?? 4,
  base: group.base ?? 10,
  attempts,
  timeMs,
  finishedAt: FINISHED_AT,
});

/** A storage stub that returns the given raw string for any key. */
const storageWith = (raw: string | null) => ({
  getItem: vi.fn((_key: string): string | null => raw),
});

/** Stores a JSON document and loads it back through loadRecords. */
const load = (document: unknown): readonly ScoreRecord[] =>
  loadRecords(storageWith(JSON.stringify(document)));

describe('loadRecords', () => {
  describe('reading', () => {
    it('reads the RECORDS_STORAGE_KEY key', () => {
      const storage = storageWith(null);

      loadRecords(storage);

      expect(storage.getItem).toHaveBeenCalledTimes(1);
      expect(storage.getItem).toHaveBeenCalledWith(RECORDS_STORAGE_KEY);
    });

    it('returns an empty list when nothing is stored', () => {
      expect(loadRecords(storageWith(null))).toEqual([]);
    });

    it('returns an empty list for broken JSON', () => {
      expect(loadRecords(storageWith('{not json'))).toEqual([]);
      expect(loadRecords(storageWith(''))).toEqual([]);
    });

    it('returns an empty list when getItem throws', () => {
      const storage = {
        getItem: vi.fn((_key: string): string | null => {
          throw new Error('storage is blocked');
        }),
      };

      expect(loadRecords(storage)).toEqual([]);
    });

    it.each(['{}', '"text"', '42', 'null', 'true', '{"0":{"id":"a"}}'])(
      'returns an empty list when the JSON root is not an array: %s',
      (raw) => {
        expect(loadRecords(storageWith(raw))).toEqual([]);
      },
    );
  });

  describe('restoring valid records', () => {
    it('restores valid records', () => {
      const records = [record('a', 3, 1000), record('b', 5, 2000)];

      expect(load(records)).toEqual(records);
    });

    it('accepts fractional milliseconds and zero values', () => {
      const fractional = { ...record('a'), timeMs: 1234.56 };
      const zeros = { ...record('b', 6), timeMs: 0, finishedAt: 0 };

      expect(load([fractional, zeros])).toEqual([fractional, zeros]);
    });

    it('accepts every supported base with its longest allowed length', () => {
      const records = [
        record('bin', 3, 1000, { length: 2, base: 2 }),
        record('oct', 3, 1000, { length: 6, base: 8 }),
        record('dec', 3, 1000, { length: 6, base: 10 }),
        record('hex', 3, 1000, { length: 6, base: 16 }),
      ];

      expect(load(records)).toHaveLength(4);
    });

    it('accepts the largest safe integer as attempts', () => {
      const big = record('big', Number.MAX_SAFE_INTEGER);

      expect(load([big])).toEqual([big]);
    });
  });

  describe('dropping invalid items', () => {
    it('drops null and other non-object elements', () => {
      const valid = record('ok');

      expect(load([null, valid, 7, 'text', true, [], [valid]])).toEqual([
        valid,
      ]);
    });

    it.each([
      'id',
      'length',
      'base',
      'attempts',
      'timeMs',
      'finishedAt',
    ] as const)('drops a record without the field %s', (field) => {
      const { [field]: _removed, ...incomplete } = record('a');

      expect(load([incomplete, record('ok')])).toEqual([record('ok')]);
    });

    it.each([
      { name: 'numeric id', patch: { id: 5 } },
      { name: 'empty id', patch: { id: '' } },
      { name: 'string length', patch: { length: '4' } },
      { name: 'string base', patch: { base: '10' } },
      { name: 'string attempts', patch: { attempts: '3' } },
      { name: 'string timeMs', patch: { timeMs: '1000' } },
      { name: 'string finishedAt', patch: { finishedAt: '1' } },
      { name: 'null timeMs', patch: { timeMs: null } },
      { name: 'boolean attempts', patch: { attempts: true } },
    ])('drops a record with $name', ({ patch }) => {
      expect(load([{ ...record('a'), ...patch }, record('ok')])).toEqual([
        record('ok'),
      ]);
    });

    it.each([1, 3, 12, 32, 0, -10, 10.5])(
      'drops a record with the unsupported base %d',
      (base) => {
        expect(load([{ ...record('a'), base }, record('ok')])).toEqual([
          record('ok'),
        ]);
      },
    );

    it.each([0, 1, 7, 100, -4, 4.5])(
      'drops a record with the invalid length %d',
      (length) => {
        expect(load([{ ...record('a'), length }, record('ok')])).toEqual([
          record('ok'),
        ]);
      },
    );

    it('drops a record whose length exceeds the base', () => {
      const tooLong = record('a', 3, 1000, { length: 3, base: 2 });

      expect(load([tooLong, record('ok')])).toEqual([record('ok')]);
    });

    it.each([0, -1, 2.5, 9007199254740992])(
      'drops a record with the invalid attempts %d',
      (attempts) => {
        expect(load([{ ...record('a'), attempts }, record('ok')])).toEqual([
          record('ok'),
        ]);
      },
    );

    it('drops a record with a negative timeMs', () => {
      expect(load([{ ...record('a'), timeMs: -1 }, record('ok')])).toEqual([
        record('ok'),
      ]);
    });

    it('drops a record with a negative finishedAt', () => {
      expect(load([{ ...record('a'), finishedAt: -1 }, record('ok')])).toEqual([
        record('ok'),
      ]);
    });

    it('drops records whose JSON numbers overflow to Infinity', () => {
      const raw = `[
        {"id":"slow","length":4,"base":10,"attempts":3,"timeMs":1e400,"finishedAt":1},
        {"id":"late","length":4,"base":10,"attempts":3,"timeMs":1,"finishedAt":1e400},
        {"id":"many","length":4,"base":10,"attempts":1e400,"timeMs":1,"finishedAt":1}
      ]`;

      expect(loadRecords(storageWith(raw))).toEqual([]);
    });

    it('drops records whose NaN or Infinity was stored as null', () => {
      const document = [
        { ...record('nan'), timeMs: Number.NaN },
        { ...record('inf'), finishedAt: Number.POSITIVE_INFINITY },
      ];

      expect(load(document)).toEqual([]);
    });

    it('keeps only the valid records of a mixed array', () => {
      const first = record('first', 4, 1000);
      const second = record('second', 6, 3000);

      const result = load([
        { ...record('bad-attempts'), attempts: 0 },
        first,
        null,
        { id: 'partial' },
        second,
        { ...record('bad-base'), base: 3 },
      ]);

      expect(result).toEqual([first, second]);
    });
  });

  describe('duplicate ids', () => {
    it('keeps the first record of a repeated id', () => {
      const first = record('same', 5, 4000);
      const second = record('same', 1, 100);

      expect(load([first, second])).toEqual([first]);
    });

    it('keeps the first valid record when an earlier duplicate is invalid', () => {
      const broken = { ...record('same'), attempts: 0 };
      const valid = record('same', 3, 1000);

      expect(load([broken, valid])).toEqual([valid]);
    });
  });

  describe('normalization', () => {
    it('sorts a group by attempts, then by time', () => {
      const slowFew = record('slow-few', 3, 9000);
      const fastMany = record('fast-many', 5, 1000);
      const fastFew = record('fast-few', 3, 2000);

      expect(load([fastMany, slowFew, fastFew])).toEqual([
        fastFew,
        slowFew,
        fastMany,
      ]);
    });

    it('keeps at most MAX_RECORDS best records per group', () => {
      const own = Array.from({ length: MAX_RECORDS + 3 }, (_, index) =>
        record(`own-${index + 1}`, MAX_RECORDS + 3 - index),
      );

      const result = load(own);

      expect(result).toHaveLength(MAX_RECORDS);
      expect(result.map((item) => item.attempts)).toEqual(
        Array.from({ length: MAX_RECORDS }, (_, index) => index + 1),
      );
    });

    it('applies the limit to every group separately', () => {
      const groupA = Array.from({ length: MAX_RECORDS + 2 }, (_, index) =>
        record(`a-${index}`, index + 1, 1000, { length: 4, base: 10 }),
      );
      const groupB = Array.from({ length: MAX_RECORDS + 2 }, (_, index) =>
        record(`b-${index}`, index + 1, 1000, { length: 3, base: 16 }),
      );

      const result = load([...groupA, ...groupB]);

      expect(result.filter((item) => item.base === 10)).toHaveLength(
        MAX_RECORDS,
      );
      expect(result.filter((item) => item.base === 16)).toHaveLength(
        MAX_RECORDS,
      );
    });
  });
});

describe('saveRecords', () => {
  it('writes the records as JSON under RECORDS_STORAGE_KEY', () => {
    const storage = {
      setItem: vi.fn((_key: string, _value: string) => undefined),
    };
    const records = [record('a', 3, 1000), record('b', 5, 2000)];

    saveRecords(storage, records);

    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledWith(
      RECORDS_STORAGE_KEY,
      JSON.stringify(records),
    );
  });

  it('writes an empty array as []', () => {
    const storage = {
      setItem: vi.fn((_key: string, _value: string) => undefined),
    };

    saveRecords(storage, []);

    expect(storage.setItem).toHaveBeenCalledWith(RECORDS_STORAGE_KEY, '[]');
  });

  it('returns true when the write succeeds', () => {
    const storage = {
      setItem: vi.fn((_key: string, _value: string) => undefined),
    };

    expect(saveRecords(storage, [record('a')])).toBe(true);
  });

  it('returns false instead of throwing when setItem fails', () => {
    const storage = {
      setItem: vi.fn((_key: string, _value: string): void => {
        throw new Error('quota exceeded');
      }),
    };

    const result = saveRecords(storage, [record('a')]);

    expect(result).toBe(false);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it('does not change the records it saves', () => {
    const storage = {
      setItem: vi.fn((_key: string, _value: string) => undefined),
    };
    const records = deepFreeze([record('a', 3, 1000), record('b', 5, 2000)]);
    const snapshot = structuredClone(records);

    saveRecords(storage, records);

    expect(records).toEqual(snapshot);
    expect(Object.isFrozen(records)).toBe(true);
  });

  it('stores records that loadRecords can read back', () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string): string | null => data.get(key) ?? null,
      setItem: (key: string, value: string): void => {
        data.set(key, value);
      },
    };
    const records = [record('a', 3, 1000), record('b', 5, 2000.5)];

    expect(saveRecords(storage, records)).toBe(true);
    expect(loadRecords(storage)).toEqual(records);
  });
});
