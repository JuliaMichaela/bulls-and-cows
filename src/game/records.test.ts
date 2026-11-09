import { describe, expect, it } from 'vitest';
import { MAX_RECORDS } from '../core/constants.js';
import type { Base, ScoreRecord } from '../core/types.js';
import { addRecord, getRecordsForSettings } from './records.js';

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
  attempts: number,
  timeMs: number,
  group: { length?: number; base?: Base } = {},
): ScoreRecord => ({
  id,
  length: group.length ?? 4,
  base: group.base ?? 10,
  attempts,
  timeMs,
  finishedAt: FINISHED_AT,
});

/** A full group: MAX_RECORDS records with attempts startAttempts, +1, +2... */
const fullGroup = (
  prefix: string,
  startAttempts: number,
  group: { length?: number; base?: Base } = {},
): ScoreRecord[] =>
  Array.from({ length: MAX_RECORDS }, (_, index) =>
    record(`${prefix}${index + 1}`, startAttempts + index, 5000, group),
  );

const idsOf = (
  records: readonly ScoreRecord[],
  length: number,
  base: Base,
): string[] =>
  records
    .filter((item) => item.length === length && item.base === base)
    .map((item) => item.id);

describe('getRecordsForSettings', () => {
  it('returns an empty list for an empty input', () => {
    expect(getRecordsForSettings([], { length: 4, base: 10 })).toEqual([]);
  });

  it('filters by length and base at the same time', () => {
    const records = [
      record('match-1', 5, 1000, { length: 4, base: 10 }),
      record('other-base', 3, 1000, { length: 4, base: 16 }),
      record('other-length', 3, 1000, { length: 3, base: 10 }),
      record('match-2', 6, 1000, { length: 4, base: 10 }),
      record('other-both', 3, 1000, { length: 6, base: 2 }),
    ];

    const result = getRecordsForSettings(records, { length: 4, base: 10 });

    expect(result.map((item) => item.id)).toEqual(['match-1', 'match-2']);
  });

  it('ranks fewer attempts above less time', () => {
    const slowButFewer = record('few-attempts', 3, 9000);
    const fastButMore = record('few-seconds', 5, 1000);

    const result = getRecordsForSettings([fastButMore, slowButFewer], {
      length: 4,
      base: 10,
    });

    expect(result.map((item) => item.id)).toEqual([
      'few-attempts',
      'few-seconds',
    ]);
  });

  it('ranks less time higher when the attempts are equal', () => {
    const slower = record('slower', 4, 3000);
    const faster = record('faster', 4, 2000);

    const result = getRecordsForSettings([slower, faster], {
      length: 4,
      base: 10,
    });

    expect(result.map((item) => item.id)).toEqual(['faster', 'slower']);
  });

  it('keeps the input order for completely equal results', () => {
    const settings = { length: 4, base: 10 } as const;
    const records = [
      record('p', 4, 2000),
      record('q', 4, 2000),
      record('r', 4, 2000),
    ];

    expect(getRecordsForSettings(records, settings).map((r) => r.id)).toEqual([
      'p',
      'q',
      'r',
    ]);
    expect(
      getRecordsForSettings([...records].reverse(), settings).map((r) => r.id),
    ).toEqual(['r', 'q', 'p']);
  });

  it('returns at most MAX_RECORDS of the best records', () => {
    const worstFirst = Array.from({ length: MAX_RECORDS + 5 }, (_, index) =>
      record(`r${MAX_RECORDS + 5 - index}`, MAX_RECORDS + 5 - index, 1000),
    );

    const result = getRecordsForSettings(worstFirst, { length: 4, base: 10 });

    expect(result).toHaveLength(MAX_RECORDS);
    expect(result.map((item) => item.attempts)).toEqual(
      Array.from({ length: MAX_RECORDS }, (_, index) => index + 1),
    );
  });

  it('does not change the input array or its records', () => {
    const records = deepFreeze([
      record('a', 5, 2000),
      record('b', 3, 3000),
      record('c', 4, 1000, { length: 3 }),
    ]);
    const snapshot = structuredClone(records);

    const result = getRecordsForSettings(records, { length: 4, base: 10 });

    expect(records).toEqual(snapshot);
    expect(result.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('returns a new array', () => {
    const records = [record('a', 3, 1000), record('b', 4, 1000)];

    const result = getRecordsForSettings(records, { length: 4, base: 10 });

    expect(result).toEqual(records);
    expect(result).not.toBe(records);
  });
});

describe('addRecord', () => {
  it('adds a record to an empty list', () => {
    const entry = record('a', 4, 1000);

    expect(addRecord([], entry)).toEqual([entry]);
  });

  it('puts the record into the group of its own settings', () => {
    const existing = record('dec', 5, 1000, { length: 4, base: 10 });
    const entry = record('hex', 6, 1000, { length: 4, base: 16 });

    const result = addRecord([existing], entry);

    expect(idsOf(result, 4, 16)).toEqual(['hex']);
    expect(idsOf(result, 4, 10)).toEqual(['dec']);
  });

  it('lets a better record push out the worst one in a full group', () => {
    const group = fullGroup('g', 2);
    const better = record('better', 1, 9999);

    const result = addRecord(group, better);

    const ids = idsOf(result, 4, 10);
    expect(ids).toHaveLength(MAX_RECORDS);
    expect(ids[0]).toBe('better');
    expect(ids).not.toContain(`g${MAX_RECORDS}`);
    expect(ids).toContain('g1');
  });

  it('does not grow a full group when the record is worse', () => {
    const group = fullGroup('g', 1);
    const worse = record('worse', MAX_RECORDS + 10, 1000);

    const result = addRecord(group, worse);

    const ids = idsOf(result, 4, 10);
    expect(ids).toHaveLength(MAX_RECORDS);
    expect(ids).not.toContain('worse');
    expect(ids).toEqual(group.map((item) => item.id));
  });

  it('applies the limit to two different groups independently', () => {
    const groupA = fullGroup('a', 2, { length: 4, base: 10 });
    const groupB = fullGroup('b', 2, { length: 3, base: 10 });

    const afterA = addRecord([...groupA, ...groupB], {
      ...record('a-best', 1, 1000),
      length: 4,
      base: 10,
    });
    const afterB = addRecord(
      afterA,
      record('b-worst', 99, 1000, { length: 3 }),
    );

    const idsA = idsOf(afterB, 4, 10);
    const idsB = idsOf(afterB, 3, 10);
    expect(idsA).toHaveLength(MAX_RECORDS);
    expect(idsA[0]).toBe('a-best');
    expect(idsB).toHaveLength(MAX_RECORDS);
    expect(idsB).not.toContain('b-worst');
    expect(idsB).toEqual(groupB.map((item) => item.id));
  });

  it('keeps the records of other groups', () => {
    const other = fullGroup('o', 1, { length: 6, base: 16 });
    const own = [record('own', 5, 1000)];

    const result = addRecord([...other, ...own], record('new', 3, 1000));

    expect(idsOf(result, 6, 16)).toEqual(other.map((item) => item.id));
    expect(idsOf(result, 4, 10)).toEqual(['new', 'own']);
  });

  it('does not add a record whose id already exists', () => {
    const existing = record('same-id', 5, 4000);
    const duplicate = record('same-id', 1, 100);
    const records = [existing];

    const result = addRecord(records, duplicate);

    expect(result).toEqual([existing]);
    expect(result).not.toBe(records);
  });

  it('keeps the arrival order for completely equal results', () => {
    const first = addRecord([], record('p', 4, 2000));
    const second = addRecord(first, record('q', 4, 2000));
    const third = addRecord(second, record('r', 4, 2000));

    expect(idsOf(third, 4, 10)).toEqual(['p', 'q', 'r']);
  });

  it('does not let a later equal record push out an earlier one', () => {
    const tied = Array.from({ length: MAX_RECORDS }, (_, index) =>
      record(`t${index + 1}`, 4, 2000),
    );

    const result = addRecord(tied, record('late', 4, 2000));

    expect(idsOf(result, 4, 10)).toEqual(tied.map((item) => item.id));
  });

  it('handles a frozen array and frozen records without mutating them', () => {
    const records = deepFreeze(fullGroup('g', 2));
    const snapshot = structuredClone(records);

    const result = addRecord(records, record('better', 1, 1000));

    expect(records).toEqual(snapshot);
    expect(idsOf(result, 4, 10)[0]).toBe('better');
    expect(Object.isFrozen(records)).toBe(true);
  });

  it('returns a new array', () => {
    const records = [record('a', 5, 1000)];

    const result = addRecord(records, record('b', 3, 1000));

    expect(result).not.toBe(records);
    expect(records).toHaveLength(1);
    expect(result).toHaveLength(2);
  });
});
