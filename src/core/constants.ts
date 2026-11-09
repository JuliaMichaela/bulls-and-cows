/** Supported numeral systems and their numeric bases. */
export const BASES = { bin: 2, oct: 8, dec: 10, hex: 16 } as const;

/** Human-readable names of the numeral systems, keyed by base. */
export const BASE_LABELS = {
  2: 'Binary',
  8: 'Octal',
  10: 'Decimal',
  16: 'Hexadecimal',
} as const satisfies Record<(typeof BASES)[keyof typeof BASES], string>;

/** All allowed bases in ascending order. */
export const BASE_VALUES = [
  BASES.bin,
  BASES.oct,
  BASES.dec,
  BASES.hex,
] as const;

/** Allowed secret length range (inclusive). */
export const MIN_LENGTH = 2;
export const MAX_LENGTH = 6;

/**
 * Canonical digit alphabet, lowercase. The first `base` characters are the
 * valid digits of a base (e.g. `ALPHABET.slice(0, 2)` is `'01'`).
 */
export const ALPHABET = '0123456789abcdef';

/** Maximum number of records kept per settings combination. */
export const MAX_RECORDS = 10;

/** localStorage key under which the records table is persisted. */
export const RECORDS_STORAGE_KEY = 'bulls-and-cows:records:v1';
