// Assembles the static site into out/: index.html, styles/ and the compiled
// dist/. Run it through `npm run build:site`, which compiles first. Only
// built-in Node modules are used, so it works the same on every platform.
import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { exit, stderr, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'out');
const entries = ['index.html', 'styles', 'dist'];

const exists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

const main = async () => {
  // Check the inputs before touching out/, so a missing build never leaves an
  // emptied folder behind.
  for (const entry of entries) {
    if (!(await exists(join(root, entry)))) {
      throw new Error(
        `"${entry}" is missing. Run "npm run build:site" (it compiles first).`,
      );
    }
  }

  // Only out/ is ever deleted.
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  for (const entry of entries) {
    await cp(join(root, entry), join(outDir, entry), { recursive: true });
  }

  stdout.write(`Site is ready in out/ (${entries.join(', ')}).\n`);
};

main().catch((error) => {
  stderr.write(`prepare-site: ${error.message}\n`);
  exit(1);
});
