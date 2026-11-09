# Bulls and Cows

A browser version of the number-guessing game [Bulls and Cows](https://en.wikipedia.org/wiki/Bulls_and_Cows),
written in TypeScript. The game logic is a set of pure functions without
classes and without the DOM; there is no backend and no runtime dependency. The
page is built entirely from TypeScript: `index.html` has an empty `<body>` apart
from the script tag.

How the code is organized, which algorithms it uses and what they cost is
described in [DESIGN.md](DESIGN.md).

## How to play

1. Choose the numeral system and the length of the secret number and press
   **Start game**. The computer picks a secret number made of **different**
   digits. The secret may start with `0`.
2. Type a guess of the same length. After each guess you get:
   - **bulls**: digits that are right and in the right place;
   - **cows**: digits that are right but in the wrong place.
3. The round ends when all digits are bulls. There is no limit on the number of
   attempts; the number of attempts and the time (from the start of the round
   to the winning guess) decide your place in the table of records.
4. **New game** returns to the settings without reloading the page. It keeps the
   length and base you used last.

A guess that is invalid (wrong length, repeated digits) or that you have already
tried is not added to the history; a message explains why.

## Settings

| Setting        | Values                                                |
| -------------- | ----------------------------------------------------- |
| Numeral system | binary (2), octal (8), decimal (10), hexadecimal (16) |
| Secret length  | 2 to 6 digits                                         |

- The length cannot exceed the number of digits of the system, because the
  digits of a secret are all different. For binary only length 2 is available;
  the other lengths are disabled.
- Switching the numeral system adjusts the length automatically (for example,
  decimal with 6 digits becomes binary with 2 digits).
- The settings screen shows how many different secrets exist for the chosen
  combination.
- The settings cannot be changed during a round.
- The input field accepts only the digits of the chosen system. In hexadecimal,
  upper and lower case are the same digit (`A` equals `a`); guesses are shown in
  lower case.

## Records

- The table of records is kept separately for every combination of numeral
  system and length, and shows the best 10 results of the selected combination.
  The table is on the settings screen and, after a win, on the round screen.
- Results are ordered by the number of attempts (fewer is better), then by time
  (less is better). A result is added only when a round is won; a round that you
  abandon with **New game** is not recorded.
- The records are stored in the browser's `localStorage` under the key
  `bulls-and-cows:records:v1` as a JSON array. Each record has the fields `id`,
  `length`, `base`, `attempts`, `timeMs` and `finishedAt`. The secret number is
  not stored. Records survive a page reload, but they are local to one browser.
- Invalid or damaged data under this key is ignored (valid records of a partly
  damaged array are kept).
- If the browser does not allow the use of `localStorage`, the game still works:
  the records are kept in memory until the page is closed, and a notice says so.

## Requirements

- Node.js **22.13 or newer 22.x, any 24.x, or 26 and newer**, and npm. This is
  the `engines` field of `package.json` (`^22.13.0 || ^24.0.0 || >=26.0.0`),
  derived from the requirements of the development dependencies (ESLint 10 and
  Vitest 5). npm only warns about an unsupported version unless
  `engine-strict` is enabled. The project was developed with Node.js 24.6.0 and
  npm 11.5.1; the hosting configuration pins Node.js 24.
- Git, because the Git hooks are installed by Husky (see below).
- A modern browser with support for ES modules. Node.js is needed only to
  install, check and build; the built game is static files.

## Getting started

```bash
npm ci
```

`npm ci` installs the dependencies exactly as in `package-lock.json`. It also
runs the `prepare` script, which installs the Git hooks.

The TypeScript sources are compiled by plain `tsc` (no bundler) into ES modules
in `dist/`, and `index.html` loads `./dist/main.js`. To run the game locally,
assemble the site and serve the `out/` folder with any static file server:

```bash
npm run build:site
python3 -m http.server 8080 --directory out
```

Then open <http://localhost:8080/>. Python is used here only as an example of a
static server; it is not a project dependency. Open the page through HTTP:
browsers normally refuse to load ES modules from `file://` addresses. After you
change the code, run `npm run build:site` again.

## npm scripts

| Command                | What it does                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| `npm run build`        | Compiles `src/` to `dist/` with `tsc -p tsconfig.build.json`.                                       |
| `npm run build:site`   | Runs `npm run build`, then assembles the publishable site in `out/` (see "Preparing a deployment"). |
| `npm test`             | Runs the unit tests once (`vitest run --passWithNoTests`).                                          |
| `npm run test:watch`   | Runs the tests in watch mode.                                                                       |
| `npm run lint`         | Runs ESLint on the whole project.                                                                   |
| `npm run format:check` | Checks the formatting of all files, including the Markdown files, with Prettier.                    |
| `npm run format`       | Formats the files with Prettier (it changes files).                                                 |
| `npm run typecheck`    | Type-checks everything under `src/`, including the tests (`tsc --noEmit`).                          |

To run all checks before a commit:

```bash
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build:site
```

## Git hooks

Husky installs two hooks when you run `npm ci` or `npm install`:

- **pre-commit** runs `lint-staged`: ESLint and Prettier on the staged files.
  It does not run tests, so a commit with failing tests is possible.
- **pre-push** runs `npm test` and blocks the push if a test fails.

## Tests and development approach

The game logic was developed test-first: for each function the tests were
committed first (and failed against a stub), and the implementation followed in
the next commit. The tests are next to the code in `src/**/*.test.ts` and use
Vitest. They cover the logic in `src/core`, `src/game` and `src/storage`; the
code in `src/ui` is not covered by automated tests.

## Preparing a deployment

The game is a static site and needs no server code. The published folder must
contain three things, with these relative paths:

```text
index.html
styles/main.css
dist/...        (the output of npm run build)
```

`index.html` refers to `./styles/main.css` and `./dist/main.js` by relative
paths (and the compiled modules import each other by relative paths too), so
the site does not depend on being served from the root of a domain.

`dist/` is listed in `.gitignore`, so it is not in the repository and has to be
built on the hosting side (or locally before an upload).

### Assembling the site

```bash
npm run build:site
```

This compiles the sources (`npm run build`) and then runs
[`scripts/prepare-site.mjs`](scripts/prepare-site.mjs), which creates the folder
`out/` with a copy of `index.html`, `styles/` and `dist/`. The script uses only
built-in Node.js modules and works the same on every operating system. It first
checks that the three inputs exist, then deletes `out/` (only that folder) and
creates it again. `out/` is ignored by Git. Source files, tests,
`node_modules/` and configuration files are not copied.

`dist/` is not cleaned by the script: `tsc` overwrites the files it produces but
does not remove files left from deleted modules. On a fresh checkout (as on a
hosting platform) this does not matter; locally, delete `dist/` first if you
removed a source file.

### Netlify

[`netlify.toml`](netlify.toml) holds the settings, so they do not have to be
entered by hand:

```toml
[build]
  command = "npm run build:site"
  publish = "out"

[build.environment]
  NODE_VERSION = "24"
```

- The build command is `npm run build:site` and the published directory is
  `out`.
- The build uses Node.js 24, which is inside the supported range of `engines`.
- Netlify installs the dependencies from `package-lock.json` before the build.
- The configuration file is read from the branch that is deployed, so deploy
  the branch that contains `netlify.toml`.

Notes:

- The compiled files have source maps (`dist/**/*.js.map`) that refer to
  `../src/*.ts`. These files are not published, so the browser's developer tools
  cannot show the original sources; the game itself does not use the maps.
- Records are stored per browser and per site address, so a new address starts
  with an empty table.
