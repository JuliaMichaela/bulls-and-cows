interface CacheEntry<Result> {
  readonly value: Result;
}

export const memoize = <Args extends readonly number[], Result>(
  fn: (...args: Args) => Result,
): ((...args: Args) => Result) => {
  const cache = new Map<string, CacheEntry<Result>>();

  return (...args) => {
    const key = JSON.stringify(args);
    const entry = cache.has(key) ? cache.get(key) : undefined;
    if (entry !== undefined) {
      return entry.value;
    }

    const value = fn(...args);
    cache.set(key, { value });
    return value;
  };
};
