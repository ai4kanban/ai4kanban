#!/usr/bin/env node
// Build the board's rules into the one file every copy of them ships as.
//
//   node scripts/build.mjs            # write ../cli/dist/kanban.mjs
//
// The sources are this package's `src/`, in TypeScript. The output is a single
// dependency-free ESM file at `cli/dist/kanban.mjs`: what `akb` runs, what the npm tarball
// carries, and what the desktop app carries a copy of.
//
// It is a build product like any other — gitignored, built by `prepare` on install and by
// `prepublishOnly` before a publish. It used to be committed at `skill/kanban.mjs`, next to
// the note, because installing a skill copied both into the user's project; that stopped
// (#213), so the output has no reason to sit beside the note and no reason to be in git.
// `skill/` is the note alone now: one source file, which src/lib/skill/install.ts inlines.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import * as esbuild from 'esbuild'

const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ENTRY = path.join(PKG_DIR, 'src', 'kanban.ts')
const OUT = path.join(PKG_DIR, 'dist', 'kanban.mjs')

const VERSION = JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'package.json'), 'utf8')).version

// The first two lines of the built file. The version line is what a board installed before
// #213 carries as its stamp, which is still how `akb update` says where such a project is
// coming from — so its shape is part of the contract (see BUILT_STAMP in src/lib/skill/).
const BANNER = `#!/usr/bin/env node
// ai4kanban ${VERSION} — built from the CLI's TypeScript sources by cli/scripts/build.mjs.
// Do not edit: every change belongs in cli/src/, and a build overwrites this file.`

await esbuild.build({
  entryPoints: [ENTRY],
  outfile: OUT,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  // The board's flows are markdown under src/guide/, inlined as strings so the one built
  // file still carries everything an agent needs (see src/lib/guide.ts).
  loader: { '.md': 'text' },
  banner: { js: BANNER },
  legalComments: 'none',
})

fs.chmodSync(OUT, 0o755)
const kb = (fs.statSync(OUT).size / 1024).toFixed(1)
process.stdout.write(`build: wrote ${path.relative(PKG_DIR, OUT)} — ${kb} kB, ai4kanban ${VERSION}\n`)
