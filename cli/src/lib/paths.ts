// Where everything lives, plus the tiny helpers every module needs (die/warn/rel,
// next-id read/write). Imported by every other module; imports only io.ts.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { BoardError, warn as sayWarning, type BoardErrorOptions } from './io'

// The skill folder — the built file sits in it, next to SKILL.md and the config.md
// template, so the folder holding them is this file's own.
export const SKILL_DIR = path.dirname(fileURLToPath(import.meta.url))

// The board lives at <root>/docs/kanban, and which root that is can change between calls:
// a move takes `--dir <path>`, and with none named the dispatcher finds the nearest board
// at or above the folder the command was run in. So these are bindings, not constants —
// `setBoardRoot` repoints them and every module importing them sees the new value, because
// an ES import is a live view of the name, not a copy of it.
//
// The default is the working directory, which is what a bare `node kanban.mjs <command>`
// from a repo root has always meant.
export let REPO_ROOT = ''
export let KANBAN = ''
export let TODO = ''
export let ARCHIVE = ''
// The archive NOTES — a hand-kept `archive.md` of what shipped, by topic. Nothing writes
// it; a board that has one shows it, a board that hasn't shows nothing. Not to be confused
// with ARCHIVE above, which is where a finished card's file goes.
export let ARCHIVE_MD = ''
export let NEXT_ID = ''
export let README = ''
export let METRICS = ''
export let MODULES_MD = ''
export let CONFIG = ''
// The board's own ignore file. It keeps docs/kanban/.env — the one place API keys live —
// out of git, and it is the board's file, never the repo's root one: that one is the
// user's, and a board that edits it is a board that surprises them.
export let KANBAN_GITIGNORE = ''
// The open releases, in the order they ship — one line each. A board that never plans a
// version still works: no file means no releases yet (see lib/releases.ts).
export let RELEASES = ''
// What a closed release left behind, one file per version id. Closing takes the release
// off the list, so this folder is the only record of what the version was meant to hold.
export let RELEASE_SUMMARIES = ''
// Setup's own checklist. Its presence is the flag: it exists while setup is unfinished,
// and the tick that closes the last box deletes it. A board with no file is a board that
// is set up — which is why boards made before this file existed stay quiet.
export let SETUP_CHECKLIST = ''
// The spec skills this project adds of its own (#403) — one folder per skill, each with its
// own SKILL.md. The board's built-in skills ship inside the command, so this folder is only
// ever the project's, and a board that never adds one has no folder at all.
export let SKILLS = ''
// Drawings of the screens cards change — one folder per card id (see the `ui-design` spec
// skill). Keyed by id, so a card leaving the board takes its folder.
// Dotted and ignored: a mockup is a working drawing, redrawn from the card whenever the
// question comes back, so it is never something the repo carries or a teammate pulls.
export let MOCKUPS = ''
export const MOCKUP_IGNORE_LINE = '.mockups/'
// All memory lives under docs/kanban/memory/: the project-wide set sits in this folder
// itself, each module's set in a subfolder named after the module.
export let MEMORY = ''
// The one goal file — board root only, never per module (see PROJECT_MEMORY_SET).
export let GOAL = ''
// The lock every writing move takes, so two of them never hand out the same id (lock.ts).
export let LOCK = ''
// Which agent runs the board, what it is set to, and whether refining happens on its own.
// The local UI has written this file since it existed; the CLI reads and writes the same
// one, because renaming it would break every board that has one for nothing a user sees.
export let UI_CONFIG = ''
// The board's one place for API keys. Kept out of git by the board's own .gitignore.
export let ENV_FILE = ''
// The one record of what is running — every process reads and writes it, so a run started
// in a terminal and one started from a button are in the same list (lib/agent/sessions.ts).
export let SESSIONS = ''
// One log file per run, named by the run's id. The durable record: a run can be reread
// long after the command that started it is gone.
export let SESSIONS_DIR = ''
// The lock that record is written under. Its own, not the board's: a run's bookkeeping
// calls board moves, and those take the board lock themselves.
export let SESSIONS_LOCK = ''
// The conversations the user has had with the agent — one file per conversation, beside
// the run logs (lib/agent/chat.ts). A chat is not a run and is nowhere in the record above.
export let CHATS_DIR = ''
// Held by the one run at a time that may rewrite the board's shared files (next-id,
// the README index, metrics.csv). Across processes, so the UI and a terminal wait for each
// other and not only for themselves.
export let INDEX_LOCK = ''
// The permanent record of every delivery — one JSON file each, tracked in git and kept
// after the card is archived (lib/agent/deliveries.ts). The live copy is a row in
// SESSIONS above; this is what outlives the machine it ran on.
export let DELIVERIES = ''
// One rule per flow, in the user's own words, appended to that flow's built-in prompt
// (#306) — `rules/<command>.md`, named by the command a user types. Tracked in git so a
// team shares them, and inside docs/kanban/, which every delivery worktree leaves out.
// Never created up front: a missing or empty file means the flow runs unchanged.
export let RULES = ''
// Delivery state that never belongs in git — #303's worktrees are the first thing in it.
// At the REPOSITORY root, not under docs/kanban/, because docs/kanban/.gitignore cannot
// reach outside its own folder — so this one line goes in the repo's own.
export let AKB_DIR = ''
export let ROOT_GITIGNORE = ''
export const AKB_IGNORE_LINE = '.akb/'

/** `.akb/`, made if it isn't there. Whatever a delivery needs on disk and must never
 *  commit goes in here — #303's worktrees first. Nothing creates it up front: an empty
 *  ignored folder is a folder git wouldn't carry anyway. */
export function ensureAkbDir(): string {
  fs.mkdirSync(AKB_DIR, { recursive: true })
  return AKB_DIR
}

/** The one line the board writes outside its own folder, added when it isn't there
 *  already. `.akb/` holds delivery state that never belongs in git — the worktrees a
 *  delivery builds in (#303) — and it sits at the repository root, which
 *  docs/kanban/.gitignore cannot reach.
 *
 *  The user's own file is otherwise left alone: the line is appended, never a rewrite.
 *  `init` calls it when a board is made, and the first worktree calls it again, so a board
 *  set up before the line existed gets it too. True when it wrote one. */
export function writeRootIgnoreIfMissing(): boolean {
  const text = fs.existsSync(ROOT_GITIGNORE) ? fs.readFileSync(ROOT_GITIGNORE, 'utf8') : ''
  if (text.split('\n').some((line) => line.trim() === AKB_IGNORE_LINE)) return false
  const separator = !text || text.endsWith('\n') ? '' : '\n'
  const block = `# Delivery state — worktrees and the like. Never committed.\n${AKB_IGNORE_LINE}\n`
  fs.writeFileSync(ROOT_GITIGNORE, `${text}${separator}${block}`)
  return true
}
/** What a Cloud checkout keeps out of git: `docs/kanban/` itself, because on that checkout
 *  the folder is a COPY of the workspace and not the record (#316). */
export const COPY_IGNORE_LINE = 'docs/kanban/'

/** Add that line to the repository's own `.gitignore` when it isn't there, the same way
 *  `.akb/` is added above. Called when a Cloud board hydrates, so a checkout pointed at a
 *  workspace never commits the copy the next read would overwrite. True when it wrote one. */
export function ignoreBoardCopyIfMissing(): boolean {
  const text = fs.existsSync(ROOT_GITIGNORE) ? fs.readFileSync(ROOT_GITIGNORE, 'utf8') : ''
  if (text.split('\n').some((line) => line.trim() === COPY_IGNORE_LINE)) return false
  const separator = !text || text.endsWith('\n') ? '' : '\n'
  const block = `# This board lives in a Cloud workspace; docs/kanban/ is a copy of it.\n${COPY_IGNORE_LINE}\n`
  fs.writeFileSync(ROOT_GITIGNORE, `${text}${separator}${block}`)
  return true
}

// ` --dir <path>` when this command was told which board with `--dir`, empty when it found
// one from the working directory. Every hint the board prints for a person to paste back —
// follow it, stop it, resume it — carries this, or the paste lands on whatever board the
// folder they are standing in has, which is usually none.
export let DIR_FLAG = ''

// Point every path above at one project's board. Called once per command, before the
// command runs. `named` is whether `--dir` chose it, which is what DIR_FLAG reports.
export function setBoardRoot(root: string, named = false): string {
  REPO_ROOT = path.resolve(root)
  DIR_FLAG = named ? ` --dir ${REPO_ROOT}` : ''
  KANBAN = path.join(REPO_ROOT, 'docs', 'kanban')
  TODO = path.join(KANBAN, 'todo')
  ARCHIVE = path.join(KANBAN, '.archive')
  ARCHIVE_MD = path.join(KANBAN, 'archive.md')
  NEXT_ID = path.join(KANBAN, 'next-id')
  README = path.join(TODO, 'README.md')
  METRICS = path.join(KANBAN, 'metrics.csv')
  MODULES_MD = path.join(KANBAN, 'modules.md')
  CONFIG = path.join(KANBAN, 'config.md')
  KANBAN_GITIGNORE = path.join(KANBAN, '.gitignore')
  RELEASES = path.join(KANBAN, 'releases.md')
  RELEASE_SUMMARIES = path.join(KANBAN, '.release-summaries')
  SETUP_CHECKLIST = path.join(KANBAN, 'setup-checklist.md')
  SKILLS = path.join(KANBAN, 'skills')
  MOCKUPS = path.join(KANBAN, '.mockups')
  MEMORY = path.join(KANBAN, 'memory')
  GOAL = path.join(MEMORY, 'goal.md')
  LOCK = path.join(KANBAN, '.lock')
  UI_CONFIG = path.join(KANBAN, 'ui.config.json')
  ENV_FILE = path.join(KANBAN, '.env')
  SESSIONS = path.join(KANBAN, '.sessions.json')
  SESSIONS_DIR = path.join(KANBAN, '.sessions')
  SESSIONS_LOCK = path.join(KANBAN, '.sessions.lock')
  CHATS_DIR = path.join(KANBAN, '.chats')
  INDEX_LOCK = path.join(KANBAN, '.index.lock')
  DELIVERIES = path.join(KANBAN, 'deliveries')
  RULES = path.join(KANBAN, 'rules')
  AKB_DIR = path.join(REPO_ROOT, '.akb')
  ROOT_GITIGNORE = path.join(REPO_ROOT, '.gitignore')
  return REPO_ROOT
}

setBoardRoot(process.cwd())

// Refuse the move and say why. Throws rather than exiting: the caller may be a UI or
// another command, and neither should die because one answer was wrong. `kind` names the
// refusal for a program reading --json; the message is for a person.
export function die(msg: string, kind?: string | BoardErrorOptions): never {
  throw new BoardError(msg, typeof kind === 'string' ? { kind } : kind)
}

// Warnings go to stderr (or into a --json answer's `warnings`) so a command's stdout —
// e.g. `create`'s id — stays clean for callers.
export function warn(msg: unknown): void {
  sayWarning(msg)
}

export const rel = (p: string): string => path.relative(REPO_ROOT, p) || p

export function readNextId(): number {
  if (!fs.existsSync(NEXT_ID)) die(`missing ${rel(NEXT_ID)}`, 'no-next-id')
  const value = fs.readFileSync(NEXT_ID, 'utf8').trim()
  if (!/^\d+$/.test(value)) die(`${rel(NEXT_ID)} is not a plain number: "${value}"`)
  return Number(value)
}

export function writeNextId(value: number): void {
  fs.writeFileSync(NEXT_ID, `${value}\n`)
}

// What a run leaves on disk, and none of it belongs in git: the record is this machine's
// answer to "what is running", and the logs are one agent's output on one afternoon. The two
// locks are transient — they exist for the milliseconds a write takes, and only ever reach
// git if a process is killed mid-write.
//
// It sits here, beside the paths it names, rather than with the run record that writes them:
// `init` is what puts these lines in the board's ignore file, and the run record reaches the
// board, which reaches `init`. A ring of imports around a plain list is a list that can be
// read before it exists.
export const RUN_IGNORE_LINES = [
  { line: '.sessions.json', comment: '# What is running on this machine, and what ran lately.' },
  { line: '.sessions/', comment: "# One log per run — the agent's own output." },
  { line: '.sessions.lock/', comment: '# The lock that record is written under.' },
  { line: '.index.lock/', comment: '# Held by the one run at a time that may rewrite the board index.' },
]
