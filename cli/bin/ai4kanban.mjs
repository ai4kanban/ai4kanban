#!/usr/bin/env node
//
// ai4kanban — the loader. Installed as `akb` too; `npx --yes ai4kanban@latest <command>` runs
// it without installing anything.
//
// It does three things and nothing else: work out how the command was typed, find this
// package's built rules, and hand the whole command line to one of the two trees in there —
// `akb raw <move>`, or everything else.
//
// Why so little lives here: the desktop app carries `bin/` and `dist/` and no node_modules
// beside them (desktop/scripts/bundle-cli.mjs), so this file must have no dependencies. The
// commands, their options and their help are declared in cli/src/lib/cli/, which the build
// bundles — with everything it needs — into the one file this loads.
//
// Node 18+, same behaviour on macOS, Linux and Windows.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PKG = JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'package.json'), 'utf8'))
const NAME = PKG.name
const VERSION = PKG.version

// How this command was reached, spelled so what it prints can be pasted straight back.
//
// A global install puts it on the PATH as `akb`, and every example everywhere spells it that
// way. It is also run as a path — `node cli/bin/ai4kanban.mjs` in a source checkout, the copy
// inside the desktop app — and printing `akb` to a reader who has none is printing a line
// that ends in `command not found`. Whoever typed it is right here in argv, so ask that
// rather than guessing: only the PATH spellings are `akb`, `.mjs` never is.
//
// Not what's on the PATH, which is a different question with a different answer: `npx` puts
// an `akb` on the PATH of THIS process and nothing else, so the reader would still be given a
// line their own shell can't run. That one is spotted by the cache it runs out of, and
// answered with the same fetch pinned to this version — never `@latest`, which is how a board
// comes to be driven by two versions of its own rules.
//
// AI4KANBAN_COMMAND is how the desktop app's launcher says what it was typed as. That
// launcher is reached as `akb` on the PATH and then runs this file by its path, so argv alone
// would report the copy inside the app — a line no reader can paste.
const PROGRAM = (() => {
  const named = (process.env.AI4KANBAN_COMMAND || '').trim()
  if (named) return named
  const entry = process.argv[1] || ''
  if (/[\\/](_npx|dlx)[\\/]/.test(entry)) return `npx --yes ${NAME}@${VERSION}`
  const base = path.basename(entry).toLowerCase().replace(/\.(cmd|ps1|exe)$/, '')
  if (base === 'akb' || base === NAME) return 'akb'
  return `node ${nearPath(entry)}`
})()

// How a path is spelled in something a person is meant to paste back.
//
// Relative when it is a short hop down from where the command was typed — a checkout says
// `node cli/bin/ai4kanban.mjs`, which reads inside a sentence and is what the project's own
// notes spell. Absolute otherwise, and absolute is the safe answer: run from `/`, a relative
// path is the whole absolute one with its leading slash quietly removed, which runs from that
// one folder and nowhere else and reads to everyone else like a typo.
function nearPath(file) {
  const near = path.relative(process.cwd(), file)
  const shortHop = near && !near.startsWith('..') && !path.isAbsolute(near) && near.split(/[\\/]/).length <= 3
  return shortHop ? near : file
}

function fail(msg) {
  console.error(`ai4kanban: ${msg}`)
  process.exit(1)
}

// The board's rules: this package's TypeScript sources built into one file by
// scripts/build.mjs. Everything this command actually does lives in there — the bookkeeping,
// the runs, the setup commands, what a skill folder holds — so it is the same one copy
// whether a terminal or the UI's buttons asks.
//
// One path, no searching. A published tarball carries `dist/`, and a source checkout builds
// it on `npm install` (the `prepare` script).
async function rules() {
  const file = path.join(PKG_DIR, 'dist', 'kanban.mjs')
  if (!fs.existsSync(file)) {
    fail(
      'no built rules in this package — run `npm install` (or `npm run build`) in cli/ ' +
        '(a published tarball carries them already, so this one is incomplete)',
    )
  }
  return import(pathToFileURL(file).href)
}

// The two trees, and the one word that picks between them. `akb raw` takes over the whole
// command line: its moves take options that collide with the rest — `create`, `archive` and
// `reject` are words on both sides — so it is handed the line untouched.
async function main() {
  const argv = process.argv.slice(2)
  const loaded = await rules()
  const shared = { program: PROGRAM, installHint: `\`${PROGRAM} install\`` }

  if (argv[0] === 'raw') {
    process.exitCode = await loaded.runBoard(argv.slice(1), { ...shared, program: `${PROGRAM} raw` })
    return
  }

  const { runAgent } = loaded
  if (typeof runAgent !== 'function') {
    fail('this copy of the board rules is too old for this command — `npm install -g ai4kanban@latest`, then `akb update`')
  }
  process.exitCode = await runAgent(argv, shared)
}

main()
