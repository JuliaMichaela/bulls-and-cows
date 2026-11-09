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
  the intersection of the `engines` fields of the development dependencies
  (ESLint 10 and Vitest 5). The project was developed with Node.js 24.6.0 and
  npm 11.5.1. `package.json` itself does not declare an `engines` field.
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
build it and serve the project folder with any static file server:

```bash
npm run build
python3 -m http.server 8080
```

Then open <http://localhost:8080/>. Python is used here only as an example of a
static server; it is not a project dependency. Open the page through HTTP:
browsers normally refuse to load ES modules from `file://` addresses. After you
change the code, run `npm run build` again.

## npm scripts

| Command                | What it does                                                  |
| ---------------------- | ------------------------------------------------------------- |
| `npm run build`        | Compiles `src/` to `dist/` with `tsc -p tsconfig.build.json`. |
| `npm test`             | Runs the unit tests once (`vitest run --passWithNoTests`).    |
| `npm run test:watch`   | Runs the tests in watch mode.                                 |
| `npm run lint`         | Runs ESLint on the whole project.                             |
| `npm run format:check` | Checks the formatting with Prettier.                          |
| `npm run format`       | Formats the files with Prettier (it changes files).           |
| `npm run typecheck`    | Type-checks everything, including the tests (`tsc --noEmit`). |

To run all checks before a commit:

```bash
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build
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

`dist/` is listed in `.gitignore`, so it is not in the repository and must be
built on the hosting side (or locally before an upload). The folders `src/`,
`node_modules/` and the configuration files are not needed in the published
site. The build command copies exactly what is needed into the folder `out/`,
which is also ignored by Git:

```bash
npm run build && mkdir -p out && cp -r index.html styles dist out/
```

Settings for a static host that builds the site from the repository (for
example Netlify):

| Setting           | Value                                                                |
| ----------------- | -------------------------------------------------------------------- |
| Build command     | `npm run build && mkdir -p out && cp -r index.html styles dist out/` |
| Publish directory | `out`                                                                |
| Node.js version   | a supported version (see [Requirements](#requirements))              |

The dependencies must be installed before the build command runs (the
equivalent of `npm ci`).

Notes:

- The repository has no configuration file for a hosting service. The values
  above have to be entered in the service's settings.
- The compiled files have source maps (`dist/**/*.js.map`) that refer to
  `../src/*.ts`. These files are not published, so the browser's developer tools
  cannot show the original sources; the game itself does not use the maps.
- Records are stored per browser and per site address, so a new address starts
  with an empty table.
