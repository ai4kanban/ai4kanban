// Setting a project up, and moving it to a newer release.
//
// `akb install` scaffolds the board, `akb skill` adds the folders a coding agent reads, and
// `akb update` refreshes an installed skill and repairs a board written by an older version.
//
// These used to live in `bin/ai4kanban.mjs`, which is the file the desktop app carries with
// no node_modules beside it. They moved in here so the command tree that declares them
// (lib/cli/setup.ts) can be declared like every other one — the bin is a loader now, and
// everything it used to do is in the one built file it loads.
//
// What they deliberately do NOT do: anything that needs a judgement call. Reading the repo,
// filling in `docs/kanban/config.md`, writing the module map, proposing the first tasks —
// those stay the agent's job. When one of these meets something it can't decide, it says so
// under "Needs your attention" and leaves it alone.

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

import { runBoard } from '../lib/board-cli'
import { missingConfigKeys } from '../lib/config-template'
import { BoardError, say } from '../lib/io'
import { installSkill, readCommandState, readSkillState } from '../lib/skill/install'
import { readCommitHook, sayCommitHook } from '../lib/skill/hook'
import type { SkillFolder } from '../lib/skill/types'
import type { Solution } from '../lib/solution'
import type { MoveResult } from '../lib/types'
import { SKILL_VERSION } from '../version'

const NAME = 'ai4kanban'
const REPO = 'https://github.com/ai4kanban/ai4kanban'

/** How a person gets this command, and how they move to a newer one. Every terminal example
 *  in the docs assumes both, and `update` can't replace the command while it is running — it
 *  names this line instead. */
export const GET_LINE = `npm install -g ${NAME}`
export const NEWER_LINE = `npm install -g ${NAME}@latest`

/** The line the user copies into their coding harness to run setup's agent steps. One
 *  wording for every harness, and the same one the local board UI hands over (#172)
 *  (kanban-ui/lib/agent.ts) — the two are separate packages, so it is repeated there rather
 *  than shared. Keep them in step. */
export const SETUP_INSTRUCTION = '/kanban. Set up this board — follow docs/kanban/setup-checklist.md.'

// The memory set used to sit at the board root before it moved into `memory/`.
const MEMORY_FILES = ['readme.md', 'goal.md', 'decisions.md', 'redesign.md', 'rejected.md']

// Both templates ship with this marker until someone fills them in.
const UNFILLED = '_(not filled in yet'

/** What every one of these takes: the folder to work on, and how the command was typed. */
export interface SetupContext {
  dir: string
  program: string
  /** `--board <dir>` — where the board goes, when it is not `<dir>/docs/kanban` (#407).
   *  Absolute by the time it gets here. */
  board?: string | null
  /** `--solution <name>` — what this board's work is, on a fresh board only. */
  solution?: Solution
}

// ---- what happened ---------------------------------------------------------

// Each command reports as it goes, so a block of output sits next to the step that produced
// it rather than all landing at the end.
class Report {
  did: string[] = []
  notes: string[] = []
  private reported = 0

  sayDid(): void {
    for (const line of this.did.slice(this.reported)) say(`  · ${line}`)
    this.reported = this.did.length
  }

  sayNotes(): void {
    if (!this.notes.length) return
    say('')
    say('Needs your attention:')
    for (const line of this.notes) say(`  ! ${line}`)
  }
}

const read = (file: string): string | null => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null)

function statOf(p: string): fs.Stats | null {
  try {
    return fs.lstatSync(p)
  } catch {
    return null
  }
}

// ---- the board -------------------------------------------------------------

// Run one board move against `root`.
//
// `--dir` is not optional here, even though the process already runs in that folder: with
// nothing named, the board is found by WALKING UP from the working directory to the nearest
// docs/kanban/. In a folder with no board of its own — every folder an install is pointed at
// — the nearest board can be anywhere above it, up to the user's home. Naming the folder is
// what keeps `install --dir X` from repairing somebody else's board and leaving X untouched.
async function boardMove(root: string, args: string[], board?: string | null): Promise<void> {
  const where = board ? ['--board', board] : ['--dir', root]
  const code = await runBoard([...args, ...where], { program: 'akb raw', cwd: root })
  if (code !== 0) throw new BoardError(`\`board ${args.join(' ')}\` failed — nothing else was changed`, { kind: 'board-move-failed' })
}

// The nearest board strictly ABOVE `root`, when there is one. A second board underneath an
// existing one is legal and occasionally meant, but it is almost never what someone who ran
// `install` in a subfolder wanted, so it is said out loud.
function boardAbove(root: string): string | null {
  let at = path.dirname(path.resolve(root))
  for (;;) {
    if (fs.existsSync(path.join(at, 'docs', 'kanban'))) return at
    const up = path.dirname(at)
    if (up === at) return null
    at = up
  }
}

// ---- install ---------------------------------------------------------------

/** Scaffold the board and nothing else (#174). The folders a coding agent reads are not
 *  written: driving the board from one is an extra, and `akb skill` is how it is asked for.
 *  That is what keeps a board made from the UI free of a folder nobody chose. */
export async function cmdInstall(ctx: SetupContext): Promise<MoveResult> {
  const report = new Report()
  const board = ctx.board ?? null
  const where = board ? path.relative(ctx.dir, board) || board : 'docs/kanban'
  say(`ai4kanban ${SKILL_VERSION} — installing into ${ctx.dir}`)
  say('')
  // A board named outright says nothing about the board above it: a second board in a repo
  // that already has one is the whole point of naming it (#407).
  const above = board || fs.existsSync(path.join(ctx.dir, 'docs', 'kanban')) ? null : boardAbove(ctx.dir)
  if (above) {
    report.notes.push(`there is already a board at ${above} — this makes a second one, and commands run here will find this one`)
  }
  await boardMove(ctx.dir, ['init', ...(ctx.solution ? ['--solution', ctx.solution] : [])], board)
  report.sayNotes()
  say('')
  // Say what landed, so nobody goes looking for the flows in the repo. They ship with the
  // command; a project holds its own board and nothing else.
  say(`That is the board, under ${where}/. The one line written outside it is \`.akb/\` in`)
  say('.gitignore, which keeps the folders a delivery works in out of git.')
  if (board) {
    say('')
    say(`This board is not the project's \`docs/kanban\`, so every command has to name it:`)
    say('')
    say(`    ${ctx.program} --board ${where} <command>`)
    say('')
    say('…or `export AI4KANBAN_BOARD=' + where + '`. A command typed inside the board folder finds it.')
  }
  say('')
  say('To drive this board from your coding agent, add the skill — from the button in the')
  say('board UI (Configuration → Agent setup), or here:')
  say('')
  say(`    ${ctx.program} skill`)
  return { installed: ctx.dir, board: board ?? path.join(ctx.dir, 'docs', 'kanban'), solution: ctx.solution ?? 'product' }
}

// ---- skill -----------------------------------------------------------------

/** Add the skill to a project, rewrite the copy it has, or say where it stands. */
export async function cmdSkill(ctx: SetupContext, mode: 'install' | 'refresh' | null): Promise<MoveResult> {
  const report = new Report()
  if (mode === 'refresh') {
    // `refresh` writes no folder that isn't there. It is how a note learns a new spelling of
    // the command without a project gaining a skill it never asked for — the desktop app
    // runs it right after putting `akb` on the PATH, so the note stops naming the copy
    // inside the app.
    const { result } = placeSkill(ctx, 'update', report)
    report.sayDid()
    report.sayNotes()
    if (!result.ok && result.error) throw new BoardError(result.error, { kind: 'skill-refused' })
    if (!result.wrote.length) say('No skill in this project — nothing to rewrite.')
    return { refreshed: result.wrote.length }
  }

  if (!mode) {
    const state = readSkillState(ctx.dir)
    say(`ai4kanban ${SKILL_VERSION} — the coding agent skill in ${ctx.dir}`)
    say('')
    for (const folder of state.folders) say(`  ${folder.path}/ — ${sayFolder(folder)} (${folder.agent})`)
    sayHookState(ctx.dir)
    say('')
    if (!state.installed) say(`Not installed. \`${ctx.program} skill install\` writes it, and so does the board UI's button.`)
    else if (state.outdated) say(`Older than this command. \`${ctx.program} skill install\` brings it up to date.`)
    else say('Up to date. Your coding agent can drive this board.')
    sayPathState()
    return { installed: state.installed, outdated: state.outdated }
  }

  say(`ai4kanban ${SKILL_VERSION} — adding the coding agent skill to ${ctx.dir}`)
  say('')
  const { result } = placeSkill(ctx, 'install', report)
  report.sayDid()
  report.sayNotes()
  if (!result.ok) throw new BoardError(result.error || 'nothing was written', { kind: 'skill-refused' })
  say('')
  say(`The flows the agent works by ship with the command — \`${ctx.program} guide\` — so they`)
  say('upgrade with it and no copy in this repo can fall behind.')
  sayPathState()
  say('')
  say('Now say this to your coding agent to try it:')
  say('')
  say(`    ${SETUP_INSTRUCTION}`)
  return { wrote: result.wrote.map((w) => w.path) }
}

// Write the skill into this project. `mode` is 'install' (write both agent folders) or
// 'update' (only refresh a folder that is already there).
function placeSkill(ctx: SetupContext, mode: 'install' | 'update', report: Report) {
  // Read the versions first: the refresh overwrites them, and `update` reports where the
  // project is coming from.
  const before = readSkillState(ctx.dir).folders
  // The one file in a skill folder that was ever the user's, from an install made before the
  // config moved out — rescued before the folder is wiped.
  for (const folder of before) {
    if (folder.state !== 'absent' && folder.state !== 'linked') {
      rescueSkillConfig(ctx.dir, path.join(ctx.dir, folder.path), report)
    }
  }
  // How this command was typed goes into the note: an install run through `npx` is the one
  // case the rules can't read off the machine, because npx's `akb` is on this process's PATH
  // and no shell the agent will ever open.
  const result = installSkill(ctx.dir, mode === 'update' ? 'present' : undefined, ctx.program)
  for (const w of result.wrote) report.did.push(`${w.refreshed ? 'refreshed' : 'wrote'} ${w.path}/ — ${w.files} (${w.agent})`)
  for (const s of result.skipped) report.notes.push(`${s.path} — ${s.why}`)
  // The commit guard (#324), which goes in wherever the skill does. The FIRST write says so,
  // so a user who ran `akb update` for something else learns it is there before a commit
  // refuses; a rewrite of the board's own copy is silent, the way a refresh is.
  if (result.hook?.wrote && !result.hook.wrote.refreshed) {
    report.did.push(
      `wrote ${result.hook.wrote.path} — refuses a commit on the branch a delivery is landing on (\`--no-verify\` gets past it)`,
    )
  }
  if (result.hook?.note) report.notes.push(result.hook.note)
  // A project that has one agent's folder but not the other's. Update never writes a folder
  // that isn't there — a plugin install keeps the skill in a read-only cache, and a board
  // installed today has no folder at all until someone asks for one. Say the line that adds
  // it and leave the choice with the user.
  if (mode === 'update' && result.wrote.length) {
    for (const folder of before) {
      if (folder.state !== 'absent') continue
      report.notes.push(
        `no ${folder.path}/ here (${folder.agent}) — \`akb skill\` writes it if you want that agent to see the board too`,
      )
    }
  }
  return { result, from: before.map((f) => f.version).find(Boolean) || null }
}

// An install made before the config moved out of the skill folder keeps the user's filled-in
// `config.md` there — and the folder is about to be wiped. Move it to where it belongs now.
function rescueSkillConfig(root: string, skillDir: string, report: Report): void {
  const old = read(path.join(skillDir, 'config.md'))
  if (!old || old.includes('{{')) return // still the blank template — nothing of the user's in it
  const boardConfig = path.join(root, 'docs', 'kanban', 'config.md')
  const current = read(boardConfig)
  if (current === null) {
    fs.mkdirSync(path.dirname(boardConfig), { recursive: true })
    fs.writeFileSync(boardConfig, old)
    report.did.push('moved your filled-in config.md out of the skill folder to docs/kanban/config.md')
    return
  }
  if (current === old) return
  const aside = path.join(root, 'docs', 'kanban', 'config.from-skill.md')
  if (fs.existsSync(aside)) return
  fs.writeFileSync(aside, old)
  report.notes.push(
    'the old skill folder held a different filled-in config.md — saved as docs/kanban/config.from-skill.md;' +
      ' fold anything worth keeping into docs/kanban/config.md and delete it',
  )
}

function sayFolder(folder: SkillFolder): string {
  if (folder.state === 'absent') return 'not installed'
  if (folder.state === 'linked') return 'a symlink into a source checkout — never written over'
  if (folder.state === 'unknown') return 'installed, version unknown'
  return `${folder.version}${folder.state === 'stale' ? ` — older than this command (${SKILL_VERSION})` : ''}`
}

// Whether the agent that reads the note it just got will find the command the note tells it
// to type. Said here, where the skill lands, rather than left for the agent's first board
// command to discover — that one comes back `command not found`, and an agent that meets that
// mid-task stops and asks instead of doing the work.
function sayPathState(): void {
  const command = readCommandState()
  if (command.onPath) return
  say('')
  say('There is no `akb` on your PATH. The note tells your agent what to run instead — the')
  say(`copy in this project, or \`npx --yes ${NAME}@${SKILL_VERSION}\`. One line makes it direct:`)
  say('')
  say(`    ${GET_LINE}`)
}

// Where the commit guard stands (#324), said next to the folders an agent reads. A project
// that is not a git repository has no hook to have, and gets no line about one.
function sayHookState(root: string): void {
  const hook = readCommitHook(root)
  if (hook.state === 'no-git') return
  say(`  ${hook.path} — ${sayCommitHook(hook.state)}`)
}

// ---- update ----------------------------------------------------------------

/** Updating is two things and nothing else: a newer command, and a board repaired to what
 *  this version expects. There is no third step where the user re-installs the skill to pick
 *  up a fixed flow — the flows ship inside the command now.
 *
 *  The first of those two this command cannot do to itself: replacing the file that is
 *  currently running is how you get a half-written command. So it names the line instead, and
 *  does the repair with the version it has. */
export async function cmdUpdate(ctx: SetupContext): Promise<MoveResult> {
  const report = new Report()
  say(`ai4kanban ${SKILL_VERSION} — updating ${ctx.dir}`)
  const { result, from } = placeSkill(ctx, 'update', report)
  const placed = result.wrote
  if (!placed.length) {
    // Nothing copied is a normal outcome: a project can simply not have the skill — it is no
    // longer written by installing a board — and a plugin install keeps it in a read-only
    // cache. The board still needs repairing either way.
    report.notes.push('no skill folder to refresh here — `akb skill` adds one; repairing the board only')
  }
  say('')
  report.sayDid()
  await repairBoard(ctx.dir, report)
  report.sayDid()
  report.sayNotes()
  say('')
  if (!placed.length) {
    say(`The board is up to date with ${SKILL_VERSION}. Every release: ${REPO}/releases`)
  } else if (!from) {
    say(`Now at ${SKILL_VERSION}. Every release: ${REPO}/releases`)
  } else if (from === SKILL_VERSION) {
    say(`Already at ${SKILL_VERSION} — the board was checked over anyway, which changes nothing.`)
  } else {
    say(`Moved from ${from} to ${SKILL_VERSION}.`)
    say(`Everything that changed: ${REPO}/compare/v${from}...v${SKILL_VERSION}`)
  }
  say('Your cards, config, and memory were left alone. Review `git diff` before committing.')
  sayCommandVersion()
  return { updated: ctx.dir, from, to: SKILL_VERSION }
}

// The repair steps an update has to run on a board written by an older version. Each one is
// mechanical; anything with a choice in it becomes a note instead.
async function repairBoard(root: string, report: Report): Promise<void> {
  const board = path.join(root, 'docs', 'kanban')
  if (!fs.existsSync(board)) {
    report.notes.push('no docs/kanban/ here — run `akb install` to scaffold the board')
    return
  }
  moveLegacyMemory(board, report)
  report.sayDid()
  // `init` on an existing board is the repair step: it adds what an older version never
  // wrote and never touches a file that's already filled in.
  await boardMove(root, ['init'])
  dropModuleGoals(board, report)
  checkConfig(board, report)
  checkModules(board, report)
}

// An older layout kept the memory set at the board root. Move each file into `memory/`.
function moveLegacyMemory(board: string, report: Report): void {
  const memory = path.join(board, 'memory')
  const moved: string[] = []
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
      report.notes.push(`both docs/kanban/${name} and docs/kanban/memory/${name} exist and differ — merge them by hand`)
    }
  }
  if (moved.length) report.did.push(`moved the memory set into docs/kanban/memory/: ${moved.join(', ')}`)
}

// `goal.md` lives at the board root of `memory/` only. An older layout gave every module a
// copy; drop the ones that say nothing the root one doesn't, and report the rest.
function dropModuleGoals(board: string, report: Report): void {
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
      report.notes.push(
        `docs/kanban/memory/${entry.name}/goal.md says something the root goal doesn't —` +
          ' fold that into docs/kanban/memory/goal.md, then delete it',
      )
    }
  }
  if (dropped) report.did.push(`removed ${dropped} leftover per-module goal.md (the goal lives at docs/kanban/memory/goal.md)`)
}

// A setting this release ships that the user's config has never heard of. Naming it is all a
// script can do — the value is the user's to choose.
function checkConfig(board: string, report: Report): void {
  const current = read(path.join(board, 'config.md'))
  if (!current) return
  const added = missingConfigKeys(current)
  if (added.length) {
    report.notes.push(
      `this release adds ${added.map((k) => `**${k}**`).join(', ')} to the config — add the line to docs/kanban/config.md and fill it in`,
    )
  }
}

function checkModules(board: string, report: Report): void {
  const map = read(path.join(board, 'modules.md'))
  if (map && map.includes(UNFILLED)) {
    report.notes.push(
      'docs/kanban/modules.md is still blank — write it from the repo (`akb guide module-map`), then re-run this command so every module gets a memory path',
    )
  }
}

// Where the command itself stands against npm. A board can only be as new as the command
// that repairs it, so an `akb` that is behind is the one thing an update can't fix from the
// inside — it says the line that fixes it, every time, rather than reporting success and
// leaving the user a release behind.
function sayCommandVersion(): void {
  const latest = latestVersion()
  say('')
  if (latest && isOlder(SKILL_VERSION, latest)) {
    say(`This command is ${SKILL_VERSION}; ${latest} is out. It can't replace itself while it runs:`)
    say('')
    say(`    ${NEWER_LINE}`)
    say('')
    say('Then run `akb update` again — a newer command is what brings newer flows.')
  } else if (latest) {
    say(`This command is ${SKILL_VERSION} — the newest published.`)
  } else {
    say(`This command is ${SKILL_VERSION}. A newer one: \`${NEWER_LINE}\``)
  }
}

// The newest published version, or null when npm can't be reached — offline, behind a proxy,
// npm not on the path. Best effort by design: an update that failed because a registry was
// unreachable would be a worse command than one that skips the check.
function latestVersion(): string | null {
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
// carries a `-beta` means `a` is the older of the two.
function isOlder(a: string, b: string): boolean {
  const parts = (v: string): number[] => v.split('-')[0]!.split('.').map((n) => Number(n) || 0)
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < 3; i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0)
  }
  return a.includes('-') && !b.includes('-')
}
