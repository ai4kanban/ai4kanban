#!/usr/bin/env node
//
// ai4kanban — the one command that sets up and updates the board. Installed as `akb` too;
// `npx --yes ai4kanban@latest <command>` runs it without installing anything.
//
//   akb install [--tracks a,b,c]   scaffold docs/kanban/
//   akb skill [install]            add the coding agent skill to this project, or say
//                                  whether it is there
//   akb update                     refresh an installed skill, repair the board, and say
//                                  the one line that puts a newer command on your path
//   akb board <move>               the board's own bookkeeping — the agent's commands
//   akb version                    print this package's version
//
// Why this exists: setup used to be a list of shell commands (`git clone`, `mkdir`, `cp -R`,
// a `printf`) that the user had to approve one at a time. This is one command instead.
//
// What install leaves in a project is the board and nothing else (#174). Driving that board
// from a coding agent is a later extra, added on purpose by `akb skill` or the button in the
// UI — so a person who works from the UI never has a skill folder they didn't ask for. What
// a skill folder holds is the built rules' own business (cli/src/lib/skill/install.ts); this
// script only says when to write one.
//
// What it deliberately does NOT do: anything that needs a judgement call. Reading the repo,
// filling in `docs/kanban/config.md`, writing the module map, proposing the first tasks —
// those stay the agent's job. When this script meets something it can't decide, it says so
// under "Needs your attention" and leaves it alone.
//
// Node 18+, no dependencies, same behaviour on macOS, Linux and Windows.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PKG = JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'package.json'), 'utf8'))
const VERSION = PKG.version
const NAME = PKG.name
const REPO = 'https://github.com/ai4kanban/ai4kanban'

// How a person gets this command, and how they move to a newer one. Written down here
// because every terminal example in the docs assumes both, and because `update` can't
// replace the command while it is running — it names this line instead.
const GET_LINE = `npm install -g ${NAME}`
const NEWER_LINE = `npm install -g ${NAME}@latest`

// How this command was reached, spelled so what it prints can be pasted straight back.
//
// A global install puts it on the PATH as `akb`, and every example everywhere spells it
// that way. It is also run as a path — `node cli/bin/ai4kanban.mjs` in a source checkout,
// the copy inside the desktop app — and printing `akb` to a reader who has none is printing
// a line that ends in `command not found`. Whoever typed it is right here in argv, so ask
// that rather than guessing: only the PATH spellings are `akb`, `.mjs` never is.
//
// Not what's on the PATH, which is a different question with a different answer: `npx` puts
// an `akb` on the PATH of THIS process and nothing else, so the reader would still be given
// a line their own shell can't run. That one is spotted by the cache it runs out of, and
// answered with the same fetch pinned to this version — never `@latest`, which is how a
// board comes to be driven by two versions of its own rules.
const PROGRAM = (() => {
  const entry = process.argv[1] || ''
  if (/[\\/](_npx|dlx)[\\/]/.test(entry)) return `npx --yes ${NAME}@${VERSION}`
  const base = path.basename(entry).toLowerCase().replace(/\.(cmd|ps1|exe)$/, '')
  if (base === 'akb' || base === NAME) return 'akb'
  // Relative to where it was typed when that is shorter and still runs — a checkout says
  // `node cli/bin/ai4kanban.mjs`, which reads inside a sentence; an absolute path doesn't.
  const near = path.relative(process.cwd(), entry)
  return `node ${near && !near.startsWith('..') ? near : entry}`
})()

// One line, when this copy isn't `akb`, for the text that spells it `akb` throughout — the
// help, and the flows a `--print` hands over. Cheaper than rewriting either, and it holds
// for the lines inside them that this command never wrote.
const SPELLED = PROGRAM === 'akb' ? '' : `This copy isn't on your PATH as \`akb\` — every \`akb\` below is \`${PROGRAM}\` here.`

// How the help opens: what the command is called, plus that line when it isn't called that.
const INTRO = [
  'Installed, it is `akb`. Without installing anything, every line below also works as\n' +
    '`npx --yes ai4kanban@latest <command>` — the same command, fetched each time.',
  SPELLED,
]
  .filter(Boolean)
  .join('\n\n')

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

// The board's rules: this package's TypeScript sources built into one file by
// scripts/build.mjs. Everything this command actually does lives in there — the
// bookkeeping, the runs, what a skill folder holds — so it is the same one copy whether a
// terminal or the UI's buttons asks.
//
// One path, no searching. A published tarball carries `dist/`, and a source checkout builds
// it on `npm install` (the `prepare` script). It used to be looked up as a *folder* holding
// SKILL.md beside it, because installing a skill copied the pair into the user's project;
// that stopped (#213), and the note is a source file the build inlines.
function builtRules() {
  const file = path.join(PKG_DIR, 'dist', 'kanban.mjs')
  if (!fs.existsSync(file)) {
    fail(
      'no built rules in this package — run `npm install` (or `npm run build`) in cli/ ' +
        '(a published tarball carries them already, so this one is incomplete)',
    )
  }
  return file
}

// ---- the built rules -------------------------------------------------------

// The one built copy of the board's rules this package carries, loaded as a module. Every
// move that is the board's own — the bookkeeping, the runs, what a skill folder holds —
// lives in there rather than here, so a terminal and the UI's buttons can never disagree.
async function rules() {
  return import(pathToFileURL(builtRules()).href)
}

// ---- placing the skill -----------------------------------------------------

// Write the skill into this project through the built rules. `mode` is 'install' (write
// both agent folders) or 'update' (only refresh a folder that is already there).
//
// Installing a board does NOT come through here any more (#174): the skill is an extra a
// person asks for, from `akb skill` or the button in the UI.
async function placeSkill(root, mode) {
  const { installSkill, readSkillState } = await rules()
  if (typeof installSkill !== 'function') {
    fail('this copy of the board rules is too old to install the skill — `npm install -g ai4kanban@latest`')
  }
  // Read the versions first: the refresh overwrites them, and `update` reports where the
  // project is coming from.
  const before = readSkillState(root).folders
  // The one file in a skill folder that was ever the user's, from an install made before
  // the config moved out — rescued before the folder is wiped.
  for (const folder of before) {
    if (folder.state !== 'absent' && folder.state !== 'linked') rescueSkillConfig(root, path.join(root, folder.path))
  }
  // How this command was typed goes into the note: an install run through `npx` is the one
  // case the rules can't read off the machine, because npx's `akb` is on this process's
  // PATH and no shell the agent will ever open.
  const result = installSkill(root, mode === 'update' ? 'present' : undefined, PROGRAM)
  for (const w of result.wrote) did.push(`${w.refreshed ? 'refreshed' : 'wrote'} ${w.path}/ — ${w.files} (${w.agent})`)
  for (const s of result.skipped) notes.push(`${s.path} — ${s.why}`)
  // A project that has one agent's folder but not the other's. Update never writes a folder
  // that isn't there — a plugin install keeps the skill in a read-only cache, and a board
  // installed today has no folder at all until someone asks for one. Say the line that adds
  // it and leave the choice with the user.
  if (mode === 'update' && result.wrote.length) {
    for (const folder of before) {
      if (folder.state !== 'absent') continue
      notes.push(`no ${folder.path}/ here (${folder.agent}) — \`akb skill\` writes it if you want that agent to see the board too`)
    }
  }
  return { result, from: before.map((f) => f.version).find(Boolean) || null }
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

function runKanban(rulesFile, root, args) {
  const result = spawnSync(process.execPath, [rulesFile, ...args], {
    cwd: root,
    stdio: 'inherit',
  })
  if (result.status !== 0) fail(`\`kanban.mjs ${args.join(' ')}\` failed — nothing else was changed`)
}

// The repair steps an update has to run on a board written by an older version. Each one is
// mechanical; anything with a choice in it becomes a note instead.
async function repairBoard(rulesFile, root) {
  const board = path.join(root, 'docs', 'kanban')
  if (!fs.existsSync(board)) {
    notes.push('no docs/kanban/ here — run `akb install` to scaffold the board')
    return
  }
  moveLegacyMemory(board)
  sayDid()
  // `init` on an existing board is the repair step: it adds what an older version never
  // wrote (config.md, modules.md, releases.md, the memory paths, the goal's `reviewed:`
  // field) and never touches a file that's already filled in.
  runKanban(rulesFile, root, ['init'])
  dropModuleGoals(board)
  await checkConfig(board)
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
// a script can do — the value is the user's to choose. The blank config is no longer a file
// beside this one: the command carries it, so the comparison comes out of the built rules.
async function checkConfig(board) {
  const current = read(path.join(board, 'config.md'))
  if (!current) return
  const { missingConfigKeys } = await import(pathToFileURL(builtRules()).href)
  if (typeof missingConfigKeys !== 'function') return
  const added = missingConfigKeys(current)
  if (added.length) {
    notes.push(`this release adds ${added.map((k) => `**${k}**`).join(', ')} to the config — add the line to docs/kanban/config.md and fill it in`)
  }
}

function checkModules(board) {
  const map = read(path.join(board, 'modules.md'))
  if (map && map.includes(UNFILLED)) {
    notes.push('docs/kanban/modules.md is still blank — write it from the repo (`akb guide module-map`), then re-run this command so every module gets a memory path')
  }
}

// ---- commands --------------------------------------------------------------

// Installing is the board and nothing else (#174). The folders a coding agent reads are not
// written: driving the board from one is an extra, and `akb skill` is how it is asked for.
// That is what keeps a board made from the UI free of a folder nobody chose.
function cmdInstall(root, tracks) {
  say(`ai4kanban ${VERSION} — installing into ${root}`)
  say('')
  runKanban(builtRules(), root, ['init', ...tracks])
  sayNotes()
  say('')
  // Say what landed, so nobody goes looking for the flows in the repo. They ship with the
  // command; a project holds its own board and nothing else.
  say('That is the board. Nothing was written outside docs/kanban/.')
  say('')
  say('To drive this board from your coding agent, add the skill — from the button in the')
  say('board UI (Configuration → Skill), or here:')
  say('')
  say(`    ${PROGRAM} skill`)
}

// Add the skill to a project, or say where it stands. The whole move belongs to the built
// rules; this prints what they did.
async function cmdSkill(root, install) {
  const { readSkillState } = await rules()
  if (typeof readSkillState !== 'function') {
    fail('this copy of the board rules is too old to install the skill — `npm install -g ai4kanban@latest`')
  }
  if (!install) {
    const state = readSkillState(root)
    say(`ai4kanban ${VERSION} — the coding agent skill in ${root}`)
    say('')
    for (const folder of state.folders) say(`  ${folder.path}/ — ${sayFolder(folder)} (${folder.agent})`)
    say('')
    if (!state.installed) say(`Not installed. \`${PROGRAM} skill install\` writes it, and so does the board UI's button.`)
    else if (state.outdated) say(`Older than this command. \`${PROGRAM} skill install\` brings it up to date.`)
    else say('Up to date. Your coding agent can drive this board.')
    await sayPathState()
    return
  }
  say(`ai4kanban ${VERSION} — adding the coding agent skill to ${root}`)
  say('')
  const { result } = await placeSkill(root, 'install')
  sayDid()
  sayNotes()
  if (!result.ok) fail(result.error || 'nothing was written')
  say('')
  say(`The flows the agent works by ship with the command — \`${PROGRAM} guide\` — so they`)
  say('upgrade with it and no copy in this repo can fall behind.')
  await sayPathState()
  say('')
  say('Now say this to your coding agent to try it:')
  say('')
  say(`    ${SETUP_INSTRUCTION}`)
}

// Whether the agent that reads the note it just got will find the command the note tells it
// to type. Said here, where the skill lands, rather than left for the agent's first board
// command to discover — that one comes back `command not found`, and an agent that meets
// that mid-task stops and asks instead of doing the work.
//
// The note itself carries the fallback, so nothing is broken either way. This is so the
// user knows what their agent is about to do, and what one line would spare it.
async function sayPathState() {
  const { readCommandState } = await rules()
  const command = typeof readCommandState === 'function' ? readCommandState() : null
  if (!command || command.onPath) return
  say('')
  say('There is no `akb` on your PATH. The note tells your agent what to run instead — the')
  say(`copy in this project, or \`npx --yes ${NAME}@${VERSION}\`. One line makes it direct:`)
  say('')
  say(`    ${GET_LINE}`)
}

function sayFolder(folder) {
  if (folder.state === 'absent') return 'not installed'
  if (folder.state === 'linked') return 'a symlink into a source checkout — never written over'
  if (folder.state === 'unknown') return 'installed, version unknown'
  return `${folder.version}${folder.state === 'stale' ? ` — older than this command (${VERSION})` : ''}`
}

// The line the user copies into their coding harness to run setup's agent steps. One
// wording for every harness, and the same one the local board UI hands over (#172)
// (kanban-ui/lib/agent.ts) — the two are separate packages, so it is repeated here rather
// than shared. Keep them in step.
const SETUP_INSTRUCTION = '/kanban. Set up this board — follow docs/kanban/setup-checklist.md.'

// Updating is two things and nothing else: a newer command, and a board repaired to what
// this version expects. There is no third step where the user re-installs the skill to
// pick up a fixed flow — the flows ship inside the command now.
//
// The first of those two this command cannot do to itself: replacing the file that is
// currently running is how you get a half-written command. So it names the line instead,
// and does the repair with the version it has.
async function cmdUpdate(root) {
  say(`ai4kanban ${VERSION} — updating ${root}`)
  const { result, from } = await placeSkill(root, 'update')
  const placed = result.wrote
  if (!placed.length) {
    // Nothing copied is a normal outcome: a project can simply not have the skill — it is
    // no longer written by installing a board — and a plugin install keeps it in a
    // read-only cache. The board still needs repairing either way.
    notes.push('no skill folder to refresh here — `akb skill` adds one; repairing the board only')
  }
  say('')
  sayDid()
  await repairBoard(builtRules(), root)
  sayDid()
  sayNotes()
  say('')
  if (!placed.length) {
    say(`The board is up to date with ${VERSION}. Every release: ${REPO}/releases`)
  } else if (!from) {
    say(`Now at ${VERSION}. Every release: ${REPO}/releases`)
  } else if (from === VERSION) {
    say(`Already at ${VERSION} — the board was checked over anyway, which changes nothing.`)
  } else {
    say(`Moved from ${from} to ${VERSION}.`)
    say(`Everything that changed: ${REPO}/compare/v${from}...v${VERSION}`)
  }
  say('Your cards, config, and memory were left alone. Review `git diff` before committing.')
  sayCommandVersion()
}

// Where the command itself stands against npm. A board can only be as new as the command
// that repairs it, so an `akb` that is behind is the one thing an update can't fix from
// the inside — it says the line that fixes it, every time, rather than reporting success
// and leaving the user a release behind.
function sayCommandVersion() {
  const latest = latestVersion()
  say('')
  if (latest && isOlder(VERSION, latest)) {
    say(`This command is ${VERSION}; ${latest} is out. It can't replace itself while it runs:`)
    say('')
    say(`    ${NEWER_LINE}`)
    say('')
    say('Then run `akb update` again — a newer command is what brings newer flows.')
  } else if (latest) {
    say(`This command is ${VERSION} — the newest published.`)
  } else {
    say(`This command is ${VERSION}. A newer one: \`${NEWER_LINE}\``)
  }
}

// The newest published version, or null when npm can't be reached — offline, behind a
// proxy, npm not on the path. Best effort by design: an update that failed because a
// registry was unreachable would be a worse command than one that skips the check.
function latestVersion() {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const result = spawnSync(npm, ['view', NAME, 'version'], {
    encoding: 'utf8',
    timeout: 10_000,
    stdio: ['ignore', 'pipe', 'ignore'],
    shell: process.platform === 'win32',
  })
  if (result.status !== 0 || !result.stdout) return null
  const value = result.stdout.trim()
  return /^\d+\.\d+\.\d+/.test(value) ? value : null
}

// Plain three-number comparison, with one rule for the suffix: same numbers and only `a`
// carries a `-beta` means `a` is the older of the two. Enough for "is there a newer one" —
// this never has to sort a list, only answer that.
function isOlder(a, b) {
  const parts = (v) => v.split('-')[0].split('.').map((n) => Number(n) || 0)
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < 3; i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0)
  }
  return a.includes('-') && !b.includes('-')
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

Get the command:  ${GET_LINE}
Move to a newer one:  ${NEWER_LINE}

${INTRO}

  akb install [--tracks a,b,c]   scaffold docs/kanban/ — the board, and nothing else
  akb skill                      whether a coding agent can drive this board
  akb skill install              add the skill: SKILL.md into .claude/skills/kanban/
                                 and .agents/skills/kanban/
  akb update                     refresh an installed skill, repair a board written by an
                                 older version, and say if a newer command is out
  akb version                    print this version
  akb help                       this text

Options
  --tracks a,b,c    the board's tracks (install only). Default: feature,bug,research
  --dir <path>      the project to work on. Default: the current folder

Installing writes the board and nothing outside docs/kanban/. Driving that board from a
coding agent is a later extra — \`akb skill install\`, or the button in the board UI under
Configuration → Skill. The flows the agent works by are not copied anywhere either: they
ship inside this command (\`akb guide\`), so updating the command updates every flow in
every project at once.

Install, skill and update are all safe to run twice. None of them edits your cards, your
config, or your memory — filling those in is the agent's job.

Put an agent to work on the board:

  akb implement 12               build the card
  akb refine 12                  sharpen it until it is ready to build
  akb create "what you want"     write the card(s) for it
  akb propose                    write the next tasks
  akb runs                       what is running
  akb log 3f2a1b04 --follow      watch a run
  akb stop 3f2a1b04              end one
  akb agent                      which agent runs them, and how it is set up

A run keeps working after the command returns. Add \`--print\` to any of the first four and
nothing starts: it prints what to do instead, filled in for this board — which is how an
agent already in a session does the job itself rather than starting a second one.

\`akb help runs\` is the whole of it — every command a coding agent may call, and when.
\`akb agent\` is where you pick the agent, its model and its key.

\`akb guide\` is the board's flows, shipped with this command: how the board works, how a
card is refined, how a release is planned. A newer command is newer flows in every project
at once, so none of them keeps a copy to fall behind.

\`akb board <move>\` is the board's own bookkeeping — the commands the agent calls between
runs. You never have to type one; \`akb board help\` lists them.

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

// The board's bookkeeping, out of the same one copy of the rules the skill folder ships.
// Everything after `board` is passed through untouched — its options are the board's, not
// this command's, and parsing them twice is how `--title "--tracks"` would go wrong.
async function cmdBoard(args) {
  const { runBoard } = await rules()
  return runBoard(args, {
    program: `${PROGRAM} board`,
    style: 'board',
    installHint: `\`${PROGRAM} install\``,
  })
}

// The runs themselves — implement a card, refine it, see what is going, stop one. Same
// story as `board`: one built copy of the rules, reached by importing it, and the whole
// command line is the command's own.
const RUN_COMMANDS = new Set([
  'implement',
  'run',
  'refine',
  'resolve',
  'revise',
  'create',
  'propose',
  'plan-release',
  // Finish setting the board up (#173) — the steps that read the repo and think, as one
  // run. It is a run like the rest: the board UI's button starts exactly this.
  'setup',
  'archive',
  'reject',
  'runs',
  'log',
  'stop',
  'resume',
  'agent',
  // The board's flows, shipped with this command rather than copied into each project.
  'guide',
  // What a started run's watcher is spawned as. Never typed by a person.
  '__watch',
])

async function cmdRun(args) {
  const { runAgent } = await rules()
  if (typeof runAgent !== 'function') {
    fail('this copy of the board rules is too old to run agents — `npm install -g ai4kanban@latest`, then `akb update`')
  }
  return runAgent(args, { program: PROGRAM, installHint: `\`${PROGRAM} install\`` })
}

async function main() {
  // `board` takes over the whole command line, so its moves can carry any option they like.
  if (process.argv[2] === 'board') {
    process.exitCode = await cmdBoard(process.argv.slice(3))
    return
  }
  // And so does a run: its options are the run's, not this command's.
  if (RUN_COMMANDS.has(process.argv[2])) {
    process.exitCode = await cmdRun(process.argv.slice(2))
    return
  }
  // The runs have a help of their own — every command, and the rule for printing a flow
  // instead of starting a run. `akb help` stays this command's, so the other is asked for
  // by name: `akb help runs`, or `akb help <any run command>`.
  if (process.argv[2] === 'help' && RUN_COMMANDS.has(process.argv[3])) {
    process.exitCode = await cmdRun(['help'])
    return
  }
  // Where this command's copy of the board's rules is on disk, and nothing else on stdout.
  // The local UI asks for it once and imports what it names: a project carries no copy of
  // the rules any more (#213), so the installed command is what knows where they are.
  // Never typed by a person — hence the name.
  if (process.argv[2] === '__rules') {
    const { rulesPath } = await rules()
    if (typeof rulesPath !== 'function') fail('this copy of the board rules is too old to say where it is')
    return say(rulesPath())
  }
  const { opts, rest } = parse(process.argv.slice(2))
  const command = rest[0]
  if (!fs.existsSync(opts.dir)) fail(`no such folder: ${opts.dir}`)
  switch (command) {
    case 'install':
      return cmdInstall(opts.dir, opts.tracks)
    // `akb skill` says where it stands; `akb skill install` writes it. Bare is the reading
    // one on purpose — the same rule the run commands follow, where the move that changes
    // something is asked for by name.
    case 'skill':
      return cmdSkill(opts.dir, rest[1] === 'install')
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
      fail(`unknown command "${command}" — try \`akb help\``)
  }
}

main()
