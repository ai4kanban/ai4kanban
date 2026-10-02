#!/usr/bin/env node
// Measure the triage lines in src/lib/signals/judge.ts on a board's own sorted items.
//
//   node scripts/triage-eval.mjs [--dir <project>]
//
// Asks Jev about every item the board has carded, ignored or left waiting, and prints what the
// lines would make of each against what became of it. Needs a Pro sign-in on this machine.
// Answers are cached under the temp folder, so moving a line and running again asks nothing.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import * as esbuild from 'esbuild'

import { REQUIRE_SHIM } from './shim.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'akb-triage-eval-')), 'triage-eval.mjs')

await esbuild.build({
  entryPoints: [path.join(HERE, 'triage-eval.ts')],
  outfile: out,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  loader: { '.md': 'text', '.tsx': 'text', '.json': 'text' },
  legalComments: 'none',
  banner: { js: REQUIRE_SHIM },
})

const run = spawnSync(process.execPath, [out, ...process.argv.slice(2)], { stdio: 'inherit' })
fs.rmSync(path.dirname(out), { recursive: true, force: true })
process.exit(run.status ?? 1)
