import { describe, expect, it, vi } from 'vitest';
import { memoize } from './memoize.js';

describe('memoize', () => {
  it('returns a function', () => {
    const memoized = memoize((n: number) => n);

    expect(typeof memoized).toBe('function');
  });

  it('returns the result of the original function unchanged', () => {
    const memoized = memoize((a: number, b: number) => a + b);

    expect(memoized(2, 3)).toBe(5);
  });

  it('calls the original function once on the first call', () => {
    const fn = vi.fn((n: number) => n * 2);
    const memoized = memoize(fn);

    memoized(4);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(4);
  });

  it('does not recompute for the same arguments', () => {
    const fn = vi.fn((n: number) => n * 2);
    const memoized = memoize(fn);

    const first = memoized(4);
    const second = memoized(4);

    expect(second).toBe(first);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('computes and caches different arguments separately', () => {
    const fn = vi.fn((n: number) => n * 2);
    const memoized = memoize(fn);

    expect(memoized(1)).toBe(2);
    expect(memoized(2)).toBe(4);
    expect(memoized(1)).toBe(2);
    expect(memoized(2)).toBe(4);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('takes every argument and their order into account', () => {
    const fn = vi.fn((a: number, b: number) => a - b);
    const memoized = memoize(fn);

    expect(memoized(2, 8)).toBe(-6);
    expect(memoized(8, 2)).toBe(6);
    expect(memoized(2, 8)).toBe(-6);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not mix up (1, 23) and (12, 3)', () => {
    const fn = vi.fn((a: number, b: number) => `${a}|${b}`);
    const memoized = memoize(fn);

    expect(memoized(1, 23)).toBe('1|23');
    expect(memoized(12, 3)).toBe('12|3');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it.each([0, false, '', null, undefined])(
    'caches the falsy result %j',
    (value) => {
      const fn = vi.fn((_n: number) => value);
      const memoized = memoize(fn);

      expect(memoized(1)).toBe(value);
      expect(memoized(1)).toBe(value);
      expect(fn).toHaveBeenCalledTimes(1);
    },
  );

  it('gives independently created memoized functions independent caches', () => {
    const fn = vi.fn((n: number) => n + 1);
    const first = memoize(fn);
    const second = memoize(fn);

    first(1);
    second(1);
    first(1);
    second(1);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('passes an error through and does not cache it', () => {
    const fn = vi
      .fn((n: number) => n * 2)
      .mockImplementationOnce(() => {
        throw new Error('original failure');
      });
    const memoized = memoize(fn);

    expect(() => memoized(1)).toThrow('original failure');
    expect(fn).toHaveBeenCalledTimes(1);

    expect(memoized(1)).toBe(2);
    expect(fn).toHaveBeenCalledTimes(2);

    expect(memoized(1)).toBe(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
