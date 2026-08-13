#!/usr/bin/env node
// Build the board's rules into the one file every copy of them ships as.
//
//   node scripts/build.mjs            # write ../skill/kanban.mjs
//   node scripts/build.mjs --check    # fail if that file isn't what the sources build to
//
// The sources are this package's `src/`, in TypeScript. The output is a single
// dependency-free ESM file at the repo's `skill/kanban.mjs`: what an installed skill folder
// holds (nothing beside it), what the npm tarball carries (bundle-skill.mjs copies the
// whole skill folder in), and what the desktop app runs.
//
// The built file IS committed, unlike the other build products here. The plugin channel
// installs the skill straight out of the repo, and this repo runs its own board through a
// symlink at `skill/` — a build left out of git would leave both with a folder that cannot
// run. `--check` is how a forgotten rebuild is caught before it ships.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import * as esbuild from 'esbuild'

const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ENTRY = path.join(PKG_DIR, 'src', 'kanban.ts')
const OUT = path.join(PKG_DIR, '..', 'skill', 'kanban.mjs')

const VERSION = JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'package.json'), 'utf8')).version

// The first two lines of the built file. The version line is what tells an installed board
// which release it is on — `akb update` reads it back to say where the user is coming from,
// so its shape is part of the contract (see BUILT_STAMP in bin/ai4kanban.mjs).
const BANNER = `#!/usr/bin/env node
// ai4kanban ${VERSION} — built from the CLI's TypeScript sources by cli/scripts/build.mjs.
// Do not edit: every change belongs in cli/src/, and a build overwrites this file.`

const check = process.argv.includes('--check')

const result = await esbuild.build({
  entryPoints: [ENTRY],
  outfile: OUT,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  banner: { js: BANNER },
  legalComments: 'none',
  write: !check,
})

const built = result.outputFiles ? result.outputFiles[0].text : fs.readFileSync(OUT, 'utf8')

if (check) {
  const have = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null
  if (have === null) {
    process.stderr.write(`build: ${path.relative(PKG_DIR, OUT)} is missing — run \`npm run build\` in cli/\n`)
    process.exit(1)
  }
  if (have !== built) {
    process.stderr.write(
      `build: ${path.relative(PKG_DIR, OUT)} is not what cli/src builds to — run \`npm run build\` in cli/ and commit it\n`,
    )
    process.exit(1)
  }
  process.stdout.write(`build: skill/kanban.mjs is up to date (${VERSION})\n`)
} else {
  fs.chmodSync(OUT, 0o755)
  const kb = (Buffer.byteLength(built) / 1024).toFixed(1)
  process.stdout.write(`build: wrote skill/kanban.mjs — ${kb} kB, ai4kanban ${VERSION}\n`)
}
