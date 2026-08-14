#!/usr/bin/env node
// What every board command prints, captured as one transcript.
//
// The board's moves have no tests; what they have is exact wording that agents read and
// act on. So the way we check a change to them is to run every move against a scratch
// board twice — once on the code before, once on the code after — and diff the two
// transcripts. Anything that moves shows up as a line; anything that shouldn't have moved
// is the bug.
//
//   cp cli/dist/kanban.mjs /tmp/kanban-before.mjs   # the built file, before your change
//   node scripts/board-probe.mjs /tmp/kanban-before.mjs /tmp/before.txt
//   (cd cli && npm run build)                    # build the rules again
//   node scripts/board-probe.mjs cli/dist/kanban.mjs /tmp/after.txt
//   diff /tmp/before.txt /tmp/after.txt
//
// Point it at `cli/bin/ai4kanban.mjs board` instead and the same transcript comes out of
// the CLI — that is how the two front doors are kept saying the same thing.
//
// The board it works on is a fresh temp folder, thrown away with the machine. Dates and
// the folder's own path are blanked, so two runs on different days still diff cleanly.

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawnSync } from 'node:child_process'

const [target, out] = process.argv.slice(2)
if (!target || !out) {
  process.stderr.write('usage: node scripts/board-probe.mjs <path-to-kanban.mjs|"<cli.mjs> board"> <out.txt>\n')
  process.exit(1)
}

// The command under test: a script, optionally with a leading subcommand ("… board").
const [script, ...prefix] = target.split(' ')
const SCRIPT = path.resolve(script)
const OUT = path.resolve(out)

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'board-probe-'))
const lines = []

function run(args, opts = {}) {
  const cwd = opts.cwd || root
  const r = spawnSync(process.execPath, [SCRIPT, ...prefix, ...args], { cwd, encoding: 'utf8' })
  const scrub = (s) =>
    (s || '')
      .split(root)
      .join('<ROOT>')
      .replace(/\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?/g, '<DATE>')
  lines.push(`\n$ board ${args.join(' ')}${opts.cwd ? `   (in ${opts.cwd.replace(root, '<ROOT>')})` : ''}`)
  lines.push(`--- exit ${r.status}`)
  if (scrub(r.stdout).trim()) lines.push(`--- stdout\n${scrub(r.stdout).trimEnd()}`)
  if (scrub(r.stderr).trim()) lines.push(`--- stderr\n${scrub(r.stderr).trimEnd()}`)
  return r
}

// ---- before there is a board ------------------------------------------------
run(['list'])
run(['peek'])
run(['help'])
run(['version'])
run(['bogus'])
run(['lisp'])

// ---- scaffolding ------------------------------------------------------------
run(['init', 'feature', 'skill'])
run(['init', 'feature', 'skill'])
run(['setup-status'])
run(['setup-done', 'install'])
run(['setup-done', 'install'])
run(['setup-done', 'nope'])

// A module map has to name a module before --modules will take one.
fs.writeFileSync(
  path.join(root, 'docs', 'kanban', 'modules.md'),
  '# Modules\n\n- **skill** — the skill itself. `skill/`\n- **site** — the landing page. `web/`\n',
)
run(['memory-init', 'skill'])
run(['memory-init', 'skill'])
run(['memory-init', 'no such module!'])

// ---- cards ------------------------------------------------------------------
run(['create', '--count', '2'])
run(['create', '--count', '0'])
run(['create', '--title', 'A first card', '--track', 'feature', '--priority', 'high', '--modules', 'skill'])
run(['create', '--title', 'A second card', '--track', 'skill', '--question', 'what should it do?'])
run(['create', '--title', 'No track'])
run(['create', '--track', 'feature', '--priority', 'high'])
run(['create', '--title', 'Bad track', '--track', 'nope'])
run(['list'])
run(['list', '--module', 'skill'])
run(['list', '--module', 'nope'])
run(['list', 'stray'])
run(['update', '4', '--priority', 'low', '--roi', 'high', '--status', 'ready'])
run(['update', '5', '--status', 'ready'])
run(['update', '999', '--status', 'ready'])
run(['update', 'abc'])
run(['update', '4', '--priority', 'sky-high'])
run(['update', '4', '--slug', 'renamed-card'])
run(['update-questions', '5', '--append', 'a second question'])
run(['update-questions', '5', '--drop', '1'])
run(['update-questions', '999', '--clear'])
run(['tag', '5', '1', 'user'])
run(['tag', '5', '9', 'user'])
run(['tag', '5', '1', 'wat'])

// ---- releases ---------------------------------------------------------------
run(['release'])
run(['release', 'list'])
run(['release', 'new', 'v1', '--goal', 'the first version worth showing someone'])
run(['release', 'new', 'v1'])
run(['release', 'new', 'v2', '--fill'])
run(['release', 'goal', 'v2', 'the second one'])
run(['release', 'goal', 'v2'])
run(['release', 'list'])
run(['update', '4', '--release', 'v1'])
run(['update', '4', '--release', 'nope'])
run(['release', 'list'])
run(['release', 'close', 'v1'])
run(['release', 'drop', 'v2'])
run(['release', 'close', 'ghost'])
run(['release', 'bogus'])

// ---- a card that repeats ----------------------------------------------------
run(['create', '--title', 'A repeating job', '--track', 'recurring', '--cadence', '1d at 09:30'])
run(['run', '8'])
run(['run', '4'])
run(['run', '999'])
run(['update', '8', '--cadence', '3h'])
run(['update', '8', '--cadence', 'whenever'])

// ---- leaving the board ------------------------------------------------------
run(['archive', '4'])
run(['archive', '999'])
run(['reject', '5'])
run(['migrate', '--dry-run'])
run(['migrate'])
run(['metrics'])
run(['peek'])
run(['setup-status'])

// ---- run from a subfolder ---------------------------------------------------
const sub = path.join(root, 'kanban-ui', 'components')
fs.mkdirSync(sub, { recursive: true })
run(['list'], { cwd: sub })

fs.writeFileSync(OUT, lines.join('\n') + '\n')
process.stdout.write(`board-probe: wrote ${OUT} — the board it used is at ${root}\n`)
