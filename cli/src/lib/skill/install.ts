// Putting the coding agent skill into a project, and reading whether it is there.
//
// Installing a board no longer writes this (#174). A board is scaffolded on its own, and
// the skill — driving that same board from your coding agent — is added afterwards, on
// purpose: from the button in the UI's Configuration dialog, or `akb skill install` in a
// terminal. Both doors come here, so what a skill folder holds is decided once.
//
// A folder is one file: the short note the agent reads, bundled into this build the way the
// flows are. So a lone `kanban.mjs`, wherever it was loaded from, can write a whole skill
// folder without a source folder to copy from — which is what lets the desktop app install
// the skill out of the copy it carries.
//
// The command itself is NOT written beside the note (#213). Every line of the note tells the
// agent to type `akb`, and its first section says what to run when there is no such command
// here, so a copy in the project was 350 kB of build product the agent never opened —
// committed by whoever commits `.claude/`, and re-committed on every release. What reads the
// built file is the local UI, and it asks the installed command where its own copy is
// (`akb __rules`).

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// The note, inlined as text by the bundler (`loader: {'.md': 'text'}` in
// scripts/build.mjs), the same way the flows in src/guide/ are. It lives at the repo's
// `skill/SKILL.md` — the one copy, which is also what the npm tarball ships.
import note from '../../../../skill/SKILL.md'
import { noteCommand } from '../agent/command'
import { REPO_ROOT } from '../paths'
import { SKILL_VERSION } from '../../version'
import type { CommandState, SkillFolder, SkillInstall, SkillState, SkillWrite } from './types'

/** The two folders agents read skills from. An install writes both, so the same board
 *  answers whichever agent the user opens tomorrow — the note names no agent's folder in
 *  its own words, so it runs from any of them. The `agent` label is what the skill pane
 *  shows beside a folder, so it names every agent that reads it: a Cursor user who sees
 *  only "Codex" there reads it as "not supported". */
const TARGETS: { rel: string; agent: string }[] = [
  { rel: path.join('.claude', 'skills', 'kanban'), agent: 'Claude Code' },
  { rel: path.join('.agents', 'skills', 'kanban'), agent: 'Codex, Cursor, OpenCode, DeepSeek Harness, ZCode' },
]

/** What lands in a folder, and nothing else. Named rather than counted so the report can
 *  say what a press of the button wrote. */
const CONTENTS = 'SKILL.md (the note)'

/** How a person gets a newer command. Never run from here — a global install is the user's
 *  line to type, the same way `akb update` names it instead of replacing itself. */
export const NEWER_COMMAND_LINE = 'npm install -g ai4kanban@latest'

// The version an install leaves on the note, on its own last line. It is how a project says
// which release wrote its skill folder — `akb update` reads it back to say where the project
// is coming from. An HTML comment, so the agent reading the note never meets it as prose.
const NOTE_STAMP = /^<!-- ai4kanban (\S+) -->$/m

// The same stamp as the build writes into the first lines of the built file. Read for a
// folder written before the command stopped being installed beside the note (#213): that
// copy is what carried the version then.
const BUILT_STAMP = /^\/\/ ai4kanban (\S+) — built /m

// This built file. In the bundle every module collapses into one output file, so this is
// that file wherever it was loaded from — the npm package, or the copy inside the desktop
// app. Nothing copies it any more; it is what `rulesPath` hands to whoever asks.
const SELF = fileURLToPath(import.meta.url)

/** Where this copy of the board's rules is on disk.
 *
 *  For the local UI: it loads the rules as a module rather than shelling out (the board
 *  polls every second and a half), and since a project no longer carries a copy, it asks the
 *  installed command for this path once and imports what it names. `akb __rules` prints it. */
export function rulesPath(): string {
  return SELF
}

function read(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

function statOf(p: string): fs.Stats | null {
  try {
    return fs.lstatSync(p)
  } catch {
    return null
  }
}

/** The released version of the skill installed in `dir`, or null when it doesn't say.
 *
 *  Today it is stamped on the note. Older folders carry it on the command that used to be
 *  written beside the note instead — in that file's build stamp, or, older still, in a
 *  constant it declared. All three have to read, or an update couldn't say what a long-stale
 *  project is coming from. */
function versionIn(dir: string): string | null {
  const note = read(path.join(dir, 'SKILL.md'))
  const stampedNote = note?.match(NOTE_STAMP)
  if (stampedNote) return stampedNote[1]!
  const src = read(path.join(dir, 'kanban.mjs'))
  if (!src) return null
  const stamped = src.slice(0, 400).match(BUILT_STAMP)
  if (stamped) return stamped[1]!
  const baked = src.match(/const SKILL_VERSION = '([^']+)'/)
  return baked ? baked[1]! : null
}

/** Plain three-number comparison, with one rule for the suffix: same numbers and only `a`
 *  carries a `-beta` means `a` is the older. Enough for "is this one behind" — it never has
 *  to sort a list, only answer that. */
function isOlder(a: string, b: string): boolean {
  const parts = (v: string) => v.split('-')[0]!.split('.').map((n) => Number(n) || 0)
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < 3; i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0)
  }
  return a.includes('-') && !b.includes('-')
}

/** Where the project sits — the board root's repo when nothing else is named. */
function rootOr(root?: string): string {
  const dir = root || REPO_ROOT
  if (!dir) throw new Error('no project to install the skill into — point the board at one first')
  return dir
}

function folderState(dir: string): { state: SkillFolder['state']; version: string | null } {
  const st = statOf(dir)
  if (!st) return { state: 'absent', version: null }
  // A source checkout of this repo symlinks its skill folder at the real `skill/`. Copying
  // over it would overwrite the source, so it is reported and never written.
  if (st.isSymbolicLink()) return { state: 'linked', version: versionIn(dir) }
  if (!fs.existsSync(path.join(dir, 'SKILL.md'))) return { state: 'absent', version: null }
  const version = versionIn(dir)
  if (!version) return { state: 'unknown', version: null }
  return { state: isOlder(version, SKILL_VERSION) ? 'stale' : 'current', version }
}

/** Whether this project can be driven from a coding agent, folder by folder. Reads files
 *  and nothing else — cheap enough to ask on every open of the dialog. */
export function readSkillState(root?: string): SkillState {
  const dir = rootOr(root)
  const folders: SkillFolder[] = TARGETS.map((target) => ({
    path: target.rel.split(path.sep).join('/'),
    agent: target.agent,
    ...folderState(path.join(dir, target.rel)),
  }))
  return {
    version: SKILL_VERSION,
    folders,
    installed: folders.some((f) => f.state !== 'absent'),
    outdated: folders.some((f) => f.state === 'stale'),
  }
}

/** The paragraph in the note that says how the command is spelled, and the markers around
 *  it in the source. The note ships with the general answer — every way there is to reach
 *  the command, since a copy read out of a plugin cache was installed by nobody. An install
 *  is not general: it is being run BY the command, on this machine, so it knows the answer
 *  and writes it down. That is a line the agent reads instead of a sequence it works
 *  through, and working through it is where a session goes wrong. */
const COMMAND_BLOCK = /<!-- command -->\n[\s\S]*?\n<!-- \/command -->/

const NPX = `npx --yes ai4kanban@${SKILL_VERSION}`

function commandParagraph(command: string): string {
  // `akb` is only ever what a reader on ANOTHER machine finds — this note is committed, and
  // the teammate who clones the repo installed nothing. So the fallback survives either way;
  // what changes is which one leads.
  if (command === 'akb') {
    return [
      'Use `akb` in the commands below. If it is not on `PATH`, use `' + NPX + '` instead,',
      'state that once, and never install the command globally.',
    ].join('\n')
  }
  // Fetched rather than installed: there is no copy on this machine to fall back to, so
  // this one is the whole answer.
  if (command.startsWith('npx ')) {
    return [
      '`akb` is not installed on this machine. Use `' + command + '` wherever a command',
      'below says `akb`. Never install the command globally; you may suggest',
      '`npm install -g ai4kanban` to the user.',
    ].join('\n')
  }
  // The command on its own line, in a block: it can be a long absolute path, and a path
  // wrapped mid-sentence is a path that gets copied wrong.
  return [
    '`akb` is not installed on this machine. Wherever a command below says `akb`, run:',
    '',
    '```text',
    command,
    '```',
    '',
    'If that is missing too, use `' + NPX + '` instead. Never install the command globally;',
    'you may suggest `npm install -g ai4kanban` to the user.',
  ].join('\n')
}

/** Write the skill into `dir`, replacing whatever is there.
 *
 *  Wholesale, so what an older version left behind goes with it — the `references/` folder
 *  of copied flows, the config template that used to sit here, and now the command's own
 *  350 kB file (#213). All three stopped being installed; none should linger in a project
 *  that once had them, and clearing them is what turns an update into two deletions the
 *  user commits without working out what they were. */
function writeFolder(dir: string, command: string): void {
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const filled = note.replace(COMMAND_BLOCK, commandParagraph(command))
  fs.writeFileSync(path.join(dir, 'SKILL.md'), `${filled.trimEnd()}\n\n<!-- ai4kanban ${SKILL_VERSION} -->\n`)
}

/** Add the skill to a project, or bring the copy it has up to date.
 *
 *  `only` is 'present' for an update, which refreshes a folder that is already there and
 *  writes none that isn't: an absent folder is usually deliberate — a plugin install keeps
 *  the skill in a read-only cache, and now that installing a board no longer writes one,
 *  not having it is the ordinary state.
 *
 *  `invoked` is how the caller was typed, when it knows — `npx` is the one spelling that
 *  can't be worked out from here (see `noteCommand`). */
export function installSkill(root?: string, only?: 'present', invoked?: string): SkillInstall {
  let dir: string
  try {
    dir = rootOr(root)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), wrote: [], skipped: [], state: emptyState() }
  }
  const command = noteCommand(dir, invoked)
  const wrote: SkillWrite[] = []
  const skipped: SkillInstall['skipped'] = []
  for (const target of TARGETS) {
    const dest = path.join(dir, target.rel)
    const shown = target.rel.split(path.sep).join('/')
    const { state } = folderState(dest)
    if (state === 'linked') {
      skipped.push({ path: shown, agent: target.agent, why: 'a symlink into a source checkout — left untouched' })
      continue
    }
    if (state === 'absent' && only === 'present') continue
    try {
      writeFolder(dest, command)
    } catch (e) {
      skipped.push({ path: shown, agent: target.agent, why: e instanceof Error ? e.message : String(e) })
      continue
    }
    wrote.push({ path: shown, agent: target.agent, files: CONTENTS, refreshed: state !== 'absent' })
  }
  const state = readSkillState(dir)
  if (!wrote.length && skipped.length) {
    return { ok: false, error: `nothing was written — ${skipped.map((s) => `${s.path}: ${s.why}`).join('; ')}`, wrote, skipped, state }
  }
  return { ok: true, wrote, skipped, state }
}

function emptyState(): SkillState {
  return { version: SKILL_VERSION, folders: [], installed: false, outdated: false }
}

/** The `akb` on the user's PATH against this copy of the command.
 *
 *  Best effort: a machine with no `akb` and one whose `akb` won't run both come back as
 *  "not there", which is the same thing to do about. It spawns a process, so it is asked
 *  for by name rather than folded into the state above. */
export function readCommandState(): CommandState {
  const onPath = commandVersion()
  return {
    version: SKILL_VERSION,
    onPath,
    behind: !onPath || isOlder(onPath, SKILL_VERSION),
    line: NEWER_COMMAND_LINE,
  }
}

function commandVersion(): string | null {
  const result = spawnSync('akb', ['version'], {
    encoding: 'utf8',
    timeout: 10_000,
    stdio: ['ignore', 'pipe', 'ignore'],
    shell: process.platform === 'win32',
  })
  if (result.status !== 0 || !result.stdout) return null
  const value = result.stdout.trim().split('\n').pop()?.trim() ?? ''
  return /^\d+\.\d+\.\d+/.test(value) ? value : null
}
