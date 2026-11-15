// Ledger — a fast make.fun frontend, handed in by main.ts.
//
// The frontend is the static files in app/ (index.html plus small ES
// modules and one stylesheet, no build step, no framework). It reads only
// make.fun's public API over GET. This program copies app/ and
// screenshots/ next to this file into the output directory and writes
// dossier.json there with the kit's vendored library
// (vendor/makefun-frontend.ts, unchanged), so the judge reads exactly the
// screenshots, the first-load bytes and the source that are handed in.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(root, 'app'), join(outDir, 'app'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(root, 'screenshots'))) {
  cpSync(join(root, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// Same caps the gate uses: the dossier text is capped at 160 KiB, at most
// 3 screenshots of 256 KiB each, app/ at most 993 entries / 16 MiB.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 3, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 16777216,
  }),
);
