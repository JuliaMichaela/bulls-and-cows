import type { GuessResult } from './types.js';

export const evaluateGuess = (secret: string, guess: string): GuessResult => {
  const secretDigits = [...secret.toLowerCase()];
  const guessDigits = [...guess.toLowerCase()];

  const bulls = guessDigits.reduce(
    (count, digit, index) =>
      digit === secretDigits[index] ? count + 1 : count,
    0,
  );

  const secretSet = new Set(secretDigits);
  const matches = guessDigits.filter((digit) => secretSet.has(digit)).length;

  return { bulls, cows: matches - bulls };
};
