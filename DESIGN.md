# Design notes

This document describes how the game is built: which modules exist, which data
structures and algorithms they use, what these cost in time and memory, and
which clean-code principles are applied where. It describes the code as it is
in the repository; file names are links to the code.

## Contents

1. [Project structure](#1-project-structure)
2. [Data structures](#2-data-structures)
3. [Algorithms](#3-algorithms)
4. [Complexity](#4-complexity)
5. [Clean code principles](#5-clean-code-principles)

## 1. Project structure

```text
index.html            empty <body> except the <script type="module">
styles/main.css       all styles
src/
  main.ts             entry point: mounts the app into document.body
  core/               pure game rules, no DOM
  game/               pure game state, settings and records, no DOM
  storage/            localStorage access, always through an injected Storage
  ui/                 everything that touches the DOM, the clock or randomness
```

Dependencies point one way: `ui` → `storage` → `game` → `core` (`ui` also
imports from `game` and `core` directly; `storage` uses `addRecord` from
`game`). Nothing in `core` or `game` imports from `ui`, and nothing in `core`
imports from `game` or `storage`.

| Module                                                         | Responsibility                                                                                 |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [`core/constants.ts`](src/core/constants.ts)                   | Bases, labels, length range, digit alphabet, records limit, storage key.                       |
| [`core/types.ts`](src/core/types.ts)                           | `Base`, `GameSettings`, `GuessResult`, `HistoryEntry`, `GameState`, `ScoreRecord`.             |
| [`core/digits.ts`](src/core/digits.ts)                         | `createDigitValidator(base)`: "is this character a digit of the base?".                        |
| [`core/guess.ts`](src/core/guess.ts)                           | `isValidGuess(guess, length, base)`.                                                           |
| [`core/evaluation.ts`](src/core/evaluation.ts)                 | `evaluateGuess(secret, guess)` → bulls and cows.                                               |
| [`core/secret.ts`](src/core/secret.ts)                         | `generateSecret(length, base, random)`.                                                        |
| [`core/memoize.ts`](src/core/memoize.ts)                       | `memoize(fn)` for pure functions of numbers.                                                   |
| [`core/combinatorics.ts`](src/core/combinatorics.ts)           | `countPossibleSecrets(length, base)`, recursive and memoized.                                  |
| [`game/settings.ts`](src/game/settings.ts)                     | Which lengths a base allows; clamping settings to the allowed range.                           |
| [`game/state.ts`](src/game/state.ts)                           | `startGame` and `submitGuess`: the immutable state of one round.                               |
| [`game/records.ts`](src/game/records.ts)                       | Sorting, grouping and limiting the records table.                                              |
| [`storage/records-storage.ts`](src/storage/records-storage.ts) | `loadRecords` and `saveRecords`: validation and (de)serialization.                             |
| [`ui/app.ts`](src/ui/app.ts)                                   | Wires UI and logic. Owns the secret, the clock, randomness, the records table and the storage. |
| [`ui/settings-screen.ts`](src/ui/settings-screen.ts)           | Settings form.                                                                                 |
| [`ui/game-screen.ts`](src/ui/game-screen.ts)                   | Round screen: input, attempt history, timer, messages.                                         |
| [`ui/records-view.ts`](src/ui/records-view.ts)                 | Records table of one length/base group.                                                        |
| [`ui/dom.ts`](src/ui/dom.ts), [`ui/timer.ts`](src/ui/timer.ts) | `createElement` helper; `formatDuration` and `startTicker`.                                    |

The rules above are enforced, not only agreed on. [`eslint.config.js`](eslint.config.js)
forbids classes and the DOM globals (`document`, `window`, `localStorage`, ...)
in `src/core` and `src/game`, and forbids `innerHTML`, `outerHTML` and
`insertAdjacentHTML` everywhere.

## 2. Data structures

**Secret and guess: `string`.** A secret such as `0123` must keep its leading
zero, which a number would lose. Strings are immutable, comparable and can be
spread into characters. Digits are stored in canonical lower case, so `A` and
`a` are the same hex digit
([`ALPHABET`](src/core/constants.ts) is `0123456789abcdef`).

**Bases and lengths: literal types and constants.** `BASES` is declared with
`as const`, and `Base` (`2 | 8 | 10 | 16`) is derived from it
([`types.ts`](src/core/types.ts)), so the list of bases exists in one place and
an unsupported base does not type-check. The valid digits of a base are the
first `base` characters of `ALPHABET`.

**`GameSettings` `{ length, base }`.** A small immutable object. Because the
same pair identifies a group of records, it is reused as the "group key".

**`GameState`.** One immutable object per round:

- `settings`, `secret`: fixed for the round.
- `history: readonly HistoryEntry[]`: attempts in the order they were made.
- `status: 'idle' | 'playing' | 'won'`: a small union instead of several
  booleans, so impossible combinations cannot be represented.
- `startedAt` / `finishedAt: number | null`: epoch milliseconds. The state
  stores timestamps, not a running counter, so the duration is derived as
  `finishedAt - startedAt` and no timer state has to be kept in the core.

Every update creates a new object (`{ ...state, history: [...history, entry] }`
in [`state.ts`](src/game/state.ts)); the old state is never mutated.

**Attempt history: a `readonly HistoryEntry[]` array.** The history is
append-only and read in order (attempt number = position + 1), which is exactly
what an array gives. A `HistoryEntry` is `{ guess, bulls, cows }`. The cost of
copying the array on each attempt is `O(n)` with a handful of attempts, and in
return old snapshots stay valid.

**`Set` for uniqueness and lookup.** A `Set` of characters answers "any
repeated digit?" (`isValidGuess`, [`guess.ts`](src/core/guess.ts)) and "is this
guess digit in the secret?" (`evaluateGuess`,
[`evaluation.ts`](src/core/evaluation.ts)) in `O(1)` per element. A `Set` of
seen ids removes duplicate records when loading
([`records-storage.ts`](src/storage/records-storage.ts)).

**`Map` for the memoization cache.** [`memoize.ts`](src/core/memoize.ts) keeps a
`Map<string, { value }>` per memoized function. The key is
`JSON.stringify(args)`, which is enough for the intended use (finite numeric
arguments) and cannot confuse `(1, 23)` with `(12, 3)`. The value is wrapped in
an object so that results such as `0`, `false`, `null` or `undefined` are cached
correctly and presence is checked with `Map.has`, not by truthiness.

**Records: one flat `readonly ScoreRecord[]`.** A record is
`{ id, length, base, attempts, timeMs, finishedAt }`. The table is a flat array
and the group of a record is derived from its `length` and `base`. A
`Map<group, records>` would make lookup of one group cheaper, but the table is
tiny (see [section 4](#4-complexity)), and a flat array serializes to JSON
as-is, is trivial to validate element by element, and keeps `addRecord` and
`loadRecords` simple.

## 3. Algorithms

### 3.1 `generateSecret` ([`core/secret.ts`](src/core/secret.ts))

Draw without replacement from a pool of digits:

1. Pool = the first `base` characters of `ALPHABET`.
2. Repeat `length` times: call `random()` once, take
   `index = floor(random() * pool.length)`, append `pool[index]` to the secret
   and build a new pool without that element
   (`[...pool.slice(0, index), ...pool.slice(index + 1)]`).

Example, base 10, length 4, `random` returning `0.5, 0, 0.99, 0.2`:
pool `0123456789` → index 5 → `5`; pool `012346789` → index 0 → `0`; pool
`12346789` → index 7 → `9`; pool `1234678` → index 1 → `2`; the secret is `5092`.

Digits cannot repeat because a chosen digit leaves the pool. The first digit
may be `0`. If `random()` is uniform, every ordered selection of `length` digits
has the same probability, `1 / P(base, length)` (see 3.4).

`random` is a parameter (default `Math.random`), so tests pass a deterministic
sequence. `random` must return a value in `[0, 1)`; otherwise, and for
`length < 1` or `length > base`, a `RangeError` is thrown. The pool is rebuilt
as a new array on every step, with no `splice` or `push`.

### 3.2 Input validation

- **`createDigitValidator(base)`**
  ([`digits.ts`](src/core/digits.ts)) is curried: it computes the valid digit
  string once (`ALPHABET.slice(0, base)`) and returns a predicate
  `(char) => char.length === 1 && digits.includes(char.toLowerCase())`.
  Empty strings, longer strings and any other character are rejected.
- **`isValidGuess(guess, length, base)`**
  ([`guess.ts`](src/core/guess.ts)) is true when (1) `guess.length === length`,
  (2) every character passes the validator, and (3) the lower-cased characters
  are all different (`new Set(chars).size === chars.length`). Nothing is trimmed
  or corrected, so `" 012"` is invalid.
- **Typing in the UI** ([`game-screen.ts`](src/ui/game-screen.ts)): the same
  `createDigitValidator` filters the field. A `beforeinput` handler removes
  disallowed characters from typed or pasted text and cuts the text to the free
  room (the field also has `maxlength = length`); an `input` handler is a
  fallback that cleans the value and keeps the caret next to the characters that
  stayed. Repeated digits are intentionally not removed: submitting them shows a
  message.
- **Settings** ([`game/settings.ts`](src/game/settings.ts)):
  `getAvailableLengths(base)` is `MIN_LENGTH .. min(MAX_LENGTH, base)`, so base
  2 allows only length 2. `normalizeSettings` clamps the length into that range,
  which is how `decimal / 6` becomes `binary / 2` when the base is switched.

### 3.3 `evaluateGuess` ([`core/evaluation.ts`](src/core/evaluation.ts))

Both strings are lower-cased and split into characters. Digits are unique in a
valid secret and in a valid guess; the algorithm relies on that.

1. **bulls** = the number of positions where the guess digit equals the secret
   digit (`reduce` over the guess with the index).
2. **matches** = the number of guess digits that occur anywhere in the secret
   (`filter` with a `Set` of the secret digits).
3. **cows** = `matches - bulls`.

Every guess digit that is in the secret is either in the right place (a bull)
or not (a cow), and with unique digits it is counted exactly once, so the
subtraction is correct.

Example: secret `0123`, guess `0321`. Bulls: position 1 (`0`) and position 3
(`2`), so 2. All four guess digits are in the secret, so matches = 4 and
cows = 4 − 2 = 2.

The function does not validate its input; that is the job of `isValidGuess`.

### 3.4 `countPossibleSecrets` ([`core/combinatorics.ts`](src/core/combinatorics.ts))

The number of different secrets is the number of ordered selections of `k`
different digits out of `b` (a secret may start with `0`, so nothing is
subtracted for a leading zero):

```text
P(b, k) = b · (b − 1) · … · (b − k + 1) = b! / (b − k)!
```

The implementation is the recursion `P(b, k) = b · P(b − 1, k − 1)` with two
base cases: `k = 0` gives `1` (the empty secret), and `k > b` gives `0` (there
are not enough digits). For example `P(16, 6) = 16·15·14·13·12·11 = 5 765 760`.

The function is wrapped in [`memoize`](src/core/memoize.ts), and the recursive
call goes through the wrapped function, so every intermediate pair is cached
too: after `(6, 16)` the cache also holds `(5, 15)`, `(4, 14)`, ..., `(0, 10)`.
The cache is created once when the module loads and lives as long as the page.
The settings screen calls the function on every change of the settings, so
repeated calls cost one cache lookup.

### 3.5 One round ([`game/state.ts`](src/game/state.ts))

`startGame(settings, secret, now)` returns a `playing` state with an empty
history. `submitGuess(state, guess, now)` is a pure function that either
returns **the same state object** (the guess is rejected) or a new one:

1. status is not `playing` → same state;
2. `!isValidGuess(...)` → same state;
3. the guess, lower-cased, is already in the history → same state;
4. otherwise `evaluateGuess`, append `{ guess, bulls, cows }`, and if
   `bulls === length` set `status: 'won'` and `finishedAt: now`.

Returning the same reference is the signal for "nothing changed". The caller
([`ui/app.ts`](src/ui/app.ts)) compares `next === current` and then decides the
reason to show (round over, invalid, or repeated).

### 3.6 Records

**Ordering** ([`game/records.ts`](src/game/records.ts)): fewer attempts first,
then less time. `compareScores` is `a.attempts - b.attempts || a.timeMs - b.timeMs`.
`Array.prototype.sort` is stable, so records with equal scores keep the order in
which they arrived: the earlier result stays ahead.

**`getRecordsForSettings(records, settings)`**: keep the records of the group
(same `length` and `base`), sort the filtered copy, take the first
`MAX_RECORDS` (10).

**`addRecord(records, record)`**:

1. if a record with the same `id` exists, return a copy of the table;
2. take all records of other groups unchanged;
3. add the new record to its own group, sort, and keep the best `MAX_RECORDS`.

Groups never compete with each other, and the new record is last in its group
before sorting, so a later result with equal scores cannot push an earlier one
out. Nothing is mutated.

**When a record is created** ([`ui/app.ts`](src/ui/app.ts), `createRound`):
only on the `playing → won` transition. `attempts` is the history length,
`timeMs` is `finishedAt - startedAt` from the final state, and the `id` is
created once per round. After a win, `submitGuess` rejects every guess, so a
round cannot produce a second record; `addRecord` also ignores an existing id.
A round abandoned with "New game" produces no record. The secret is not part of
a record.

**Persistence** ([`storage/records-storage.ts`](src/storage/records-storage.ts)):

- `saveRecords` writes `JSON.stringify(records)` under the key
  `bulls-and-cows:records:v1` and returns `false` instead of throwing if
  serialization or `setItem` fails.
- `loadRecords` reads the key and returns `[]` when it is missing, unreadable
  or not valid JSON, or when the root is not an array. Each element is checked
  by a type guard (`isScoreRecord`: non-empty string `id`, a supported `base`, an
  integer `length` between `MIN_LENGTH` and `min(MAX_LENGTH, base)`, a positive
  safe-integer `attempts`, finite non-negative `timeMs` and `finishedAt`) and
  invalid elements are dropped. Only the known fields are copied. Duplicate ids
  are removed first (the first valid record wins), and only then are the records
  run through `addRecord` to restore the sorting and the per-group limit. Doing
  the id check before the limit matters: otherwise the first record of an id
  could drop out of the top 10 and a later record with the same id would be
  accepted.
- [`ui/app.ts`](src/ui/app.ts) reads `window.localStorage` inside `try/catch`
  (the property access itself can throw). The table always lives in memory; if
  storage is unavailable or a write fails, the game keeps working and a notice
  says that results are kept only until the page is closed.

## 4. Complexity

Notation:

- `k`: secret length (2 to 6 in the UI);
- `b`: base (2, 8, 10 or 16);
- `n`: number of accepted attempts in the history of the current round;
- `m`: number of records in the table;
- `g`: number of records in one length/base group;
- `s`: length of the stored JSON string;
- `n_r`: number of elements in the stored JSON array.

Because `k ≤ 6` and `b ≤ 16`, all costs below are tiny in practice. The Big-O
values are stated in the parameters so that the reasoning stays visible.

### The four required functions

| Function                       | Time                               | Extra memory |
| ------------------------------ | ---------------------------------- | ------------ |
| `generateSecret(k, b)`         | `O(k · b)`                         | `O(b)`       |
| `evaluateGuess(secret, guess)` | `O(k)`                             | `O(k)`       |
| `isValidGuess(guess, k, b)`    | `O(k · b)`                         | `O(k + b)`   |
| `countPossibleSecrets(k, b)`   | `O(k)` first call, `O(1)` repeated | `O(k)`       |

**`generateSecret`: time `O(k · b)`, memory `O(b)`.** Building the pool costs
`O(b)`. Each of the `k` steps copies the remaining pool into a new array
(`slice` + spread), at most `b` elements, so the loop costs at most `k · b`
(precisely `Σ (b − i)` for `i = 0..k−1`, which is `k·b − k(k−1)/2`). Appending a
digit to the string costs at most `O(k)` per step in the worst case, `O(k²)`
overall, which is not larger than `k · b` because `k ≤ b`. Memory: the new pool
is built while the old one is still alive, so at most two arrays of size `≤ b`
exist at once, plus the result of length `k`.

**`evaluateGuess`: time `O(k)`, memory `O(k)`.** Here `k` is the length of the
secret (the guess has the same length). Lower-casing and splitting both strings
is `O(k)`. `reduce` for the bulls is one pass. Building the `Set` is `O(k)`, and
`filter` does one `Set.has` per guess digit, which is `O(1)` on average, so the
matches also cost `O(k)`. Without the `Set`, checking membership with
`includes` would make the same step `O(k²)`. The arrays and the `Set` take
`O(k)` memory.

**`isValidGuess`: time `O(k · b)`, memory `O(k + b)`.** The length check is
`O(1)` and returns early, so a longer input is never scanned. Creating the
validator slices the alphabet, `O(b)`. Splitting and lower-casing the `k`
characters is `O(k)`. Then `every` calls the validator `k` times, and each call
searches the digit string with `includes`, which is `O(b)`; that is `O(k · b)`
and dominates. The duplicate check is `O(k)` with a `Set`. Memory: the digit
string `O(b)`, the characters and the `Set` `O(k)`. A `Set` of digits would make
the validation `O(k + b)`; with `b ≤ 16` the simpler string search is kept.

**`countPossibleSecrets`: first call `O(k)`, repeated call `O(1)`, memory
`O(k)`.** For `k ≤ b` the recursion visits the pairs
`(k, b), (k−1, b−1), ..., (0, b−k)`: `k + 1` calls, each doing a constant
amount of work (one comparison, one multiplication, and a cache key from two
numbers). So the first call is `O(k)` in time, with a recursion depth of `k + 1`
and `k + 1` new cache entries. For `k > b` the result is `0` at once, `O(1)`.
Any later call with the same arguments, or with arguments already visited by an
earlier recursion, is one `Map` lookup, `O(1)`. Without memoization every call
would repeat the whole chain. Values stay exact: the largest supported result
is `P(16, 6) = 5 765 760`, far below `2^53`.

### The rest of the code

| Operation                                  | Time                       | Memory         | Reasoning                                                                                                                                                                          |
| ------------------------------------------ | -------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `submitGuess` (one attempt)                | `O(k · b + n · k)`         | `O(n + k + b)` | `isValidGuess` is `O(k · b)`; the duplicate search compares `n` stored guesses of length `k`; `evaluateGuess` is `O(k)`; the history is copied with `[...history, entry]`, `O(n)`. |
| a whole round of `N` attempts              | `O(N · k · b + N² · k)`    | `O(N · k)`     | The sum of the above. The quadratic term is the price of immutable history and is irrelevant for a few dozen attempts.                                                             |
| `getAvailableLengths`, `normalizeSettings` | `O(1)` (at most 5 lengths) | `O(1)`         | Constant range from `MIN_LENGTH` to `MAX_LENGTH`.                                                                                                                                  |
| `getRecordsForSettings`                    | `O(m + g log g)`           | `O(g)`         | One `filter` over `m` records, a sort of the `g` matches, a `slice` of at most `MAX_RECORDS`.                                                                                      |
| `addRecord`                                | `O(m + g log g)`           | `O(m)`         | One `some` over ids, one `filter` for the other groups, one call of `getRecordsForSettings`, and the final concatenation.                                                          |
| `saveRecords`                              | `O(m)`                     | `O(m)`         | `JSON.stringify` of `m` records.                                                                                                                                                   |
| `loadRecords`                              | `O(s + n_r · m)`           | `O(n_r)`       | Parsing is `O(s)`. For the `n_r` stored elements, validation and the id `Set` are `O(n_r)`, and every accepted record goes through `addRecord`, `O(m)` for the growing table.      |

The table is small by construction: every length/base group keeps at most
`MAX_RECORDS = 10` records, and there are 16 valid groups (base 2 allows only
length 2, the other three bases allow lengths 2 to 6), so `m ≤ 160` and
`g ≤ 11` while a record is being inserted. With these bounds `addRecord` and
`getRecordsForSettings` cost a constant amount of work, and `loadRecords` is
linear in the number of stored elements.

In the UI, adding an attempt appends one table row (the old rows are not
rebuilt), and a timer tick (every 250 ms) updates the text of one element; the
shown time is computed from `startedAt`, not counted tick by tick.

## 5. Clean code principles

**Pure functions and immutability.** The whole of `src/core` and `src/game` is
functions without side effects. [`evaluation.ts`](src/core/evaluation.ts) and
[`guess.ts`](src/core/guess.ts) only compute a result;
[`state.ts`](src/game/state.ts) never mutates a state and returns new objects
with `[...history, entry]` and `{ ...state, ... }`; the state types in
[`types.ts`](src/core/types.ts) are `readonly`, and
`getRecordsForSettings` sorts a fresh array returned by `filter`, never the
input ([`records.ts`](src/game/records.ts)).

**Dependency injection instead of hidden dependencies.** Randomness is a
parameter of `generateSecret` ([`secret.ts`](src/core/secret.ts)); time is a
parameter of `startGame` and `submitGuess` ([`state.ts`](src/game/state.ts)); the
storage is a parameter of `loadRecords` and `saveRecords`, typed as
`Pick<Storage, 'getItem'>` and `Pick<Storage, 'setItem'>`
([`records-storage.ts`](src/storage/records-storage.ts)); the screen gets `now`
and callbacks from the app ([`game-screen.ts`](src/ui/game-screen.ts)). Only
[`app.ts`](src/ui/app.ts) calls `Date.now()` and `crypto.randomUUID()`, and it
passes `Math.random` into the core explicitly. This is what makes the core
testable without a browser and without real randomness.

**Single responsibility and separation of concerns.** Each module has one job
(table in [section 1](#1-project-structure)). The UI contains no game rules:
[`game-screen.ts`](src/ui/game-screen.ts) only displays a `GuessOutcome`, and
[`app.ts`](src/ui/app.ts) delegates every decision to `submitGuess`. The
boundary is checked by ESLint (see [`eslint.config.js`](eslint.config.js)).

**Small functions with intention-revealing names.** For example `isSameGroup`,
`compareScores` ([`records.ts`](src/game/records.ts)), `maxLengthFor`
([`settings.ts`](src/game/settings.ts)), `keepFirstOfEachId`, `pickFields`,
`isPositiveSafeInteger` ([`records-storage.ts`](src/storage/records-storage.ts)),
`createRoundId` ([`app.ts`](src/ui/app.ts)). The validation of a stored record
is split into one small predicate per rule instead of one long condition.

**No magic numbers or strings.** The length range, alphabet, limit of records
and storage key live in [`constants.ts`](src/core/constants.ts) and are used by
[`settings.ts`](src/game/settings.ts),
[`records.ts`](src/game/records.ts) and
[`records-storage.ts`](src/storage/records-storage.ts). The `Base` type is
derived from `BASES`, so the list of bases is written once.

**Guard clauses and early returns.** [`state.ts`](src/game/state.ts)
(`submitGuess`) rejects non-playing, invalid and repeated guesses first and keeps
the main path flat; [`secret.ts`](src/core/secret.ts) checks the range of
`length` and of `random()` before doing any work; the submit handler of
[`game-screen.ts`](src/ui/game-screen.ts) returns at once when the round is
finished.

**Don't repeat yourself.** `createDigitValidator` is the single definition of
"valid digit" and is used by `isValidGuess` and by the input filter in
[`game-screen.ts`](src/ui/game-screen.ts); `formatDuration` is used by the
timer, the win message and the records table; `getRecordsForSettings` is used by
`addRecord` and by [`records-view.ts`](src/ui/records-view.ts).

**Types instead of casts and `any`.** There is no `any` and no `as <Type>`
assertion in the source (`as const` and `satisfies` appear only in
[`constants.ts`](src/core/constants.ts)). Data read from `localStorage` starts
as `unknown` and is narrowed with type guards
([`records-storage.ts`](src/storage/records-storage.ts)); select values are
narrowed by searching the allowed values
([`settings-screen.ts`](src/ui/settings-screen.ts)); the outcome of a guess is a
discriminated union (`GuessOutcome` in
[`game-screen.ts`](src/ui/game-screen.ts)), so the screen cannot read fields
that exist only for an accepted guess.

**Errors are handled where they can be handled.** Reading and writing storage
return a safe fallback instead of throwing
([`records-storage.ts`](src/storage/records-storage.ts)); an unavailable
`window.localStorage` is caught in [`app.ts`](src/ui/app.ts); programmer errors
such as an impossible `length` throw a `RangeError`
([`secret.ts`](src/core/secret.ts)).

**Resources are released.** [`timer.ts`](src/ui/timer.ts) `startTicker` returns
a stop function that is safe to call twice, and the screen exposes it as
`dispose`; [`app.ts`](src/ui/app.ts) calls it whenever a round screen is left, so
there is never more than one interval.

**Comments explain why, not what.** For example the notes on the stable sort in
[`records.ts`](src/game/records.ts), on why duplicate ids are removed before the
limit in [`records-storage.ts`](src/storage/records-storage.ts), and on why the
focus is set explicitly in [`app.ts`](src/ui/app.ts).

**No HTML strings.** All markup is created by
[`createElement`](src/ui/dom.ts) with `textContent` and `append`; user-visible
text can never be parsed as HTML, and ESLint rejects `innerHTML`.
