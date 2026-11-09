export const memoize = <Args extends readonly number[], Result>(
  _fn: (...args: Args) => Result,
): ((...args: Args) => Result) => {
  throw new Error('Not implemented');
};
