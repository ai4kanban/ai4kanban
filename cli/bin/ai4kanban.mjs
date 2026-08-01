#!/usr/bin/env node
//
// ai4kanban — the one command that sets up and updates the board.
//
//   npx ai4kanban install [--tracks a,b,c]   copy the skill in, scaffold docs/kanban/
//   npx ai4kanban update                     overwrite every installed skill folder, repair the board
//   npx ai4kanban version                    print this package's version
//
// Why this exists: setup used to be a list of shell commands (`git clone`, `mkdir`, `cp -R`,
// a `printf`) that the user had to approve one at a time. This is one command instead.
//
// What it deliberately does NOT do: anything that needs a judgement call. Reading the repo,
// filling in `docs/kanban/config.md`, writing the module map, proposing the first tasks —
// those stay the agent's job. When this script meets something it can't decide, it says so
// under "Needs your attention" and leaves it alone.
//
// Node 18+, no dependencies, same behaviour on macOS, Linux and Windows.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const VERSION = JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'package.json'), 'utf8')).version
const REPO = 'https://github.com/ai4kanban/ai4kanban'

// Every harness that reads skills from a folder in the repo. Install writes both, so the
// same board works whichever agent the user opens tomorrow; update only touches the ones
// that are already there.
const SKILL_TARGETS = [
  { rel: path.join('.claude', 'skills', 'kanban'), agent: 'Claude Code' },
  { rel: path.join('.agents', 'skills', 'kanban'), agent: 'Codex' },
]

// The memory set used to sit at the board root before it moved into `memory/`.
const MEMORY_FILES = ['readme.md', 'goal.md', 'decisions.md', 'redesign.md', 'rejected.md']

// Both templates ship with this marker until someone fills them in.
const UNFILLED = '_(not filled in yet'

// ---- output ----------------------------------------------------------------

const did = []
const notes = []

function say(line) {
  console.log(line)
}

function fail(msg) {
  console.error(`ai4kanban: ${msg}`)
  process.exit(1)
}

// ---- files -----------------------------------------------------------------

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDir(from, to)
    else fs.copyFileSync(from, to)
  }
}

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
}

function statOf(p) {
  try {
    return fs.lstatSync(p)
  } catch {
    return null
  }
}

// The skill folder to copy from: `skill/` inside the published package, or the repo's own
// `skill/` when this file is run straight out of a source checkout.
function bundledSkill() {
  for (const dir of [path.join(PKG_DIR, 'skill'), path.join(PKG_DIR, '..', 'skill')]) {
    if (fs.existsSync(path.join(dir, 'SKILL.md'))) return dir
  }
  fail('no skill folder inside this package — the published tarball is incomplete')
}

// The released version baked into an installed `kanban.mjs`, so update can say where the
// user is coming from. Null for an install made before the version was baked in.
function installedVersion(skillDir) {
  const src = read(path.join(skillDir, 'kanban.mjs'))
  const m = src && src.match(/const SKILL_VERSION = '([^']+)'/)
  return m ? m[1] : null
}

// ---- placing the skill -----------------------------------------------------

// Copy the skill into each target folder, wholesale: the old folder is removed first, so a
// file upstream deleted doesn't linger. `mode` is 'install' (write every target) or
// 'update' (only refresh what's already there).
function placeSkill(root, mode) {
  const source = bundledSkill()
  const placed = []
  for (const target of SKILL_TARGETS) {
    const dest = path.join(root, target.rel)
    const st = statOf(dest)
    if (st && st.isSymbolicLink()) {
      // A source checkout of this repo symlinks its skill folder at the real `skill/`.
      // Copying over it would overwrite the source, so leave it alone and say so.
      notes.push(`${target.rel} is a symlink — left untouched (it points at a source checkout)`)
      continue
    }
    if (!st && mode === 'update') continue
    const before = st ? installedVersion(dest) : null
    if (st) rescueSkillConfig(root, dest)
    if (st) fs.rmSync(dest, { recursive: true, force: true })
    copyDir(source, dest)
    did.push(`${st ? 'replaced' : 'installed'} the skill in ${target.rel}/ (${target.agent})`)
    placed.push({ dest, before, existed: Boolean(st) })
  }
  return placed
}

// An install made before the config moved out of the skill folder keeps the user's filled-in
// `config.md` there — and the folder is about to be wiped. Move it to where it belongs now.
// It's the one file in the skill folder that was ever the user's.
function rescueSkillConfig(root, skillDir) {
  const old = read(path.join(skillDir, 'config.md'))
  if (!old || old.includes('{{')) return // still the blank template — nothing of the user's in it
  const boardConfig = path.join(root, 'docs', 'kanban', 'config.md')
  const current = read(boardConfig)
  if (current === null) {
    fs.mkdirSync(path.dirname(boardConfig), { recursive: true })
    fs.writeFileSync(boardConfig, old)
    did.push('moved your filled-in config.md out of the skill folder to docs/kanban/config.md')
    return
  }
  if (current === old) return
  const aside = path.join(root, 'docs', 'kanban', 'config.from-skill.md')
  if (fs.existsSync(aside)) return
  fs.writeFileSync(aside, old)
  notes.push(
    'the old skill folder held a different filled-in config.md — saved as docs/kanban/config.from-skill.md;' +
      ' fold anything worth keeping into docs/kanban/config.md and delete it',
  )
}

// ---- the board -------------------------------------------------------------

function runKanban(skillDir, root, args) {
  const result = spawnSync(process.execPath, [path.join(skillDir, 'kanban.mjs'), ...args], {
    cwd: root,
    stdio: 'inherit',
  })
  if (result.status !== 0) fail(`\`kanban.mjs ${args.join(' ')}\` failed — nothing else was changed`)
}

// The repair steps an update has to run on a board written by an older version. Each one is
// mechanical; anything with a choice in it becomes a note instead.
function repairBoard(skillDir, root) {
  const board = path.join(root, 'docs', 'kanban')
  if (!fs.existsSync(board)) {
    notes.push('no docs/kanban/ here — run `npx ai4kanban install` to scaffold the board')
    return
  }
  moveLegacyMemory(board)
  sayDid()
  // `init` on an existing board is the repair step: it adds what an older version never
  // wrote (config.md, modules.md, the memory paths, the goal's `reviewed:` field) and never
  // touches a file that's already filled in.
  runKanban(skillDir, root, ['init'])
  dropModuleGoals(board)
  checkConfig(board)
  checkModules(board)
}

// An older layout kept the memory set at the board root. Move each file into `memory/`.
function moveLegacyMemory(board) {
  const memory = path.join(board, 'memory')
  const moved = []
  for (const name of MEMORY_FILES) {
    const from = path.join(board, name)
    const st = statOf(from)
    if (!st || !st.isFile()) continue
    fs.mkdirSync(memory, { recursive: true })
    const to = path.join(memory, name)
    const there = read(to)
    if (there === null) {
      fs.renameSync(from, to)
      moved.push(name)
    } else if (there === read(from)) {
      fs.rmSync(from)
      moved.push(name)
    } else {
      notes.push(`both docs/kanban/${name} and docs/kanban/memory/${name} exist and differ — merge them by hand`)
    }
  }
  if (moved.length) did.push(`moved the memory set into docs/kanban/memory/: ${moved.join(', ')}`)
}

// `goal.md` lives at the board root of `memory/` only. An older layout gave every module a
// copy; drop the ones that say nothing the root one doesn't, and report the rest.
function dropModuleGoals(board) {
  const memory = path.join(board, 'memory')
  if (!fs.existsSync(memory)) return
  const root = read(path.join(memory, 'goal.md'))
  let dropped = 0
  for (const entry of fs.readdirSync(memory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const file = path.join(memory, entry.name, 'goal.md')
    const text = read(file)
    if (text === null) continue
    if (text === root || text.includes(UNFILLED)) {
      fs.rmSync(file)
      dropped++
    } else {
      notes.push(
        `docs/kanban/memory/${entry.name}/goal.md says something the root goal doesn't —` +
          ' fold that into docs/kanban/memory/goal.md, then delete it',
      )
    }
  }
  if (dropped) did.push(`removed ${dropped} leftover per-module goal.md (the goal lives at docs/kanban/memory/goal.md)`)
}

// A setting this release ships that the user's config has never heard of. Naming it is all
// a script can do — the value is the user's to choose.
function checkConfig(board) {
  const template = read(path.join(bundledSkill(), 'config.md'))
  const current = read(path.join(board, 'config.md'))
  if (!template || !current) return
  const keys = (text) => [...text.matchAll(/^- \*\*(.+?)\*\*/gm)].map((m) => m[1])
  const added = keys(template).filter((k) => !keys(current).includes(k))
  if (added.length) {
    notes.push(`this release adds ${added.map((k) => `**${k}**`).join(', ')} to the config — add the line to docs/kanban/config.md and fill it in`)
  }
}

function checkModules(board) {
  const map = read(path.join(board, 'modules.md'))
  if (map && map.includes(UNFILLED)) {
    notes.push('docs/kanban/modules.md is still blank — write it from the repo (the skill\'s references/module-map.md), then re-run this command so every module gets a memory path')
  }
}

// ---- commands --------------------------------------------------------------

function cmdInstall(root, tracks) {
  say(`ai4kanban ${VERSION} — installing into ${root}`)
  const placed = placeSkill(root, 'install')
  if (!placed.length) {
    sayNotes()
    fail('nothing to install — every skill folder here is a symlink')
  }
  say('')
  sayDid()
  say('')
  runKanban(placed[0].dest, root, ['init', ...tracks])
  sayNotes()
  say('')
  // One instruction, not a list of steps. The steps are on the board now, in
  // docs/kanban/setup-checklist.md — and two lists would drift. Setup picks up at the
  // first unticked box, so this same line restarts it wherever it stops.
  say('Next, paste this into your coding agent to finish setup:')
  say('')
  say(`    ${SETUP_INSTRUCTION}`)
}

// The line the user copies into their coding harness to run setup's agent steps. One
// wording for every harness, and the same one the local board UI shows on its setup bar
// (kanban-ui/lib/agent.ts) — the two are separate packages, so it is repeated here rather
// than shared. Keep them in step.
const SETUP_INSTRUCTION = '/kanban. Set up this board — follow docs/kanban/setup-checklist.md.'

function cmdUpdate(root) {
  say(`ai4kanban ${VERSION} — updating ${root}`)
  const placed = placeSkill(root, 'update')
  const from = placed.map((p) => p.before).find(Boolean)
  if (!placed.length) {
    // Nothing copied is a normal outcome: a plugin install keeps the skill in a read-only
    // cache and a source checkout symlinks it. The board still needs repairing either way,
    // so carry on with the skill this package ships.
    notes.push('no skill folder to overwrite here — expected for a plugin install; repairing the board only')
  }
  say('')
  sayDid()
  repairBoard(placed[0]?.dest || bundledSkill(), root)
  sayDid()
  sayNotes()
  say('')
  if (!placed.length) {
    say(`This package is ${VERSION}. Every release: ${REPO}/releases`)
  } else if (!from) {
    say(`Now at ${VERSION}. Every release: ${REPO}/releases`)
  } else if (from === VERSION) {
    say(`Already at ${VERSION} — the files were re-copied anyway, which changes nothing.`)
  } else {
    say(`Moved from ${from} to ${VERSION}.`)
    say(`Everything that changed: ${REPO}/compare/v${from}...v${VERSION}`)
  }
  say('Your cards, config, and memory were left alone. Review `git diff` before committing.')
}

// Print the changes made since the last call, so each block of output sits next to the step
// that produced it instead of all landing at the end.
let reported = 0
function sayDid() {
  for (const line of did.slice(reported)) say(`  · ${line}`)
  reported = did.length
}

function sayNotes() {
  if (!notes.length) return
  say('')
  say('Needs your attention:')
  for (const line of notes) say(`  ! ${line}`)
}

const HELP = `ai4kanban ${VERSION} — set up and update the AI4Kanban board.

  npx ai4kanban install [--tracks a,b,c]   copy the skill into .claude/skills/kanban/ and
                                           .agents/skills/kanban/, then scaffold docs/kanban/
  npx ai4kanban update                     overwrite every skill folder that's already here
                                           and repair a board written by an older version
  npx ai4kanban version                    print this version
  npx ai4kanban help                       this text

Options
  --tracks a,b,c    the board's tracks (install only). Default: feature,bug,research
  --dir <path>      the project to work on. Default: the current folder

Both commands are safe to run twice. Neither one edits your cards, your config, or your
memory — filling those in is the agent's job.

Docs: ${REPO}
`

// ---- entry -----------------------------------------------------------------

function parse(argv) {
  const opts = { tracks: [], dir: process.cwd() }
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--tracks' || arg === '--track') {
      opts.tracks = String(argv[++i] || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    } else if (arg.startsWith('--tracks=')) {
      opts.tracks = arg.slice('--tracks='.length).split(',').map((t) => t.trim()).filter(Boolean)
    } else if (arg === '--dir') {
      opts.dir = path.resolve(String(argv[++i] || '.'))
    } else if (arg.startsWith('--dir=')) {
      opts.dir = path.resolve(arg.slice('--dir='.length))
    } else {
      rest.push(arg)
    }
  }
  return { opts, rest }
}

function main() {
  const { opts, rest } = parse(process.argv.slice(2))
  const command = rest[0]
  if (!fs.existsSync(opts.dir)) fail(`no such folder: ${opts.dir}`)
  switch (command) {
    case 'install':
      return cmdInstall(opts.dir, opts.tracks)
    case 'update':
      return cmdUpdate(opts.dir)
    case 'version':
    case '--version':
    case '-v':
      return say(VERSION)
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      return say(HELP)
    default:
      fail(`unknown command "${command}" — try \`npx ai4kanban help\``)
  }
}

main()
