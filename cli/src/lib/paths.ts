// Where everything lives, plus the tiny helpers every module needs (die/warn/rel,
// next-id read/write). Imported by every other module; imports only io.ts and the machine
// folder's own two, which import nothing of the board's.
//
// Two halves, and the line between them is git. What the project COMMITS is under the board
// folder — the cards, the memory, the plans, the deliveries — plus the two files that are
// this machine's and the user's to write, `.env` and `.local.json`. What the board keeps and
// cleans up ITSELF — the run record and its logs, the chats, the drawings, the comment
// batches — is machine state, and lives outside every repository under `machine/project.ts`
// (#590). Each of those has a lock beside it; the lock over the board's own files is the one
// exception, and sits in the project under `.akb/` so a sandboxed run can take it (#622).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { BoardError, warn as sayWarning, type BoardErrorOptions } from './io'
import {
  CHATS_FOLDER,
  COMMENTS_FOLDER,
  INDEX_LOCK as INDEX_LOCK_NAME,
  MOCKUPS_FOLDER,
  SESSIONS_FILE,
  SESSIONS_FOLDER,
  SESSIONS_LOCK as SESSIONS_LOCK_NAME,
  ensureProjectState,
  projectStateDir,
} from './machine/project'

// The skill folder — the built file sits in it, next to SKILL.md and the config.md
// template, so the folder holding them is this file's own.
export const SKILL_DIR = path.dirname(fileURLToPath(import.meta.url))

// A board is a folder, and which folder that is can change between calls: `--board <dir>`
// names it outright, `--dir <path>` names the project holding `docs/kanban`, and with
// neither the dispatcher finds the nearest board at or above the folder the command was run
// in. So these are bindings, not constants — `setBoardRoot` and `setBoardDir` repoint them
// and every module importing them sees the new value, because an ES import is a live view
// of the name, not a copy of it.
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
// The spec agents this project adds of its own (#403) — one folder per agent, each with its
// own AGENT.md. The board's built-in agents ship inside the command, so this folder is only
// ever the project's, and a board that never adds one has no folder at all.
export let AGENTS = ''
// Where they used to sit, read for one release so a board that already has some keeps
// working (#419). Every agent found here is reported, telling the user to move it.
export let LEGACY_AGENTS = ''
// Drawings of the screens cards change — one folder per card id (see the `ui-designer` spec
// agent). Keyed by id, so a card leaving the board takes its folder.
// Machine state: a mockup is a working drawing, redrawn from the card whenever the question
// comes back, so it is never something the repo carries or a teammate pulls.
export let MOCKUPS = ''
// The comments left on a topic's drafts, waiting to be polished (#458) — one markdown file
// per draft, under a folder per card (#572).
// Machine state like the chats: a batch is consumed by the next polish and then gone.
export let COMMENTS = ''
// All memory lives under docs/kanban/memory/: the project-wide set sits in this folder
// itself, each module's set in a subfolder named after the module.
export let MEMORY = ''
// What each agent that declares `memory: project` remembers — one folder per agent, named
// after it, holding `redesign.md` and `decisions.md` (#421, #473). Reserved: a module called
// `agents` would write its set into this folder, so `memory-init` refuses the name.
export let AGENT_MEMORY = ''
// The one goal file — board root only, never per module (see PROJECT_MEMORY_SET).
export let GOAL = ''
// The lock every writing move takes, so two of them never hand out the same id (lock.ts).
// Inside the project, under `.akb/` and named after the board: it guards the board's own
// files, and a run whose sandbox allows only the project must still be able to take it
// (#622).
export let LOCK = ''
// Which agent runs the board, what it is set to, and whether refining happens on its own.
// The local UI has written this file since it existed; the CLI reads and writes the same
// one, because renaming it would break every board that has one for nothing a user sees.
export let UI_CONFIG = ''
// What each agent runs its model as, on THIS computer (#443). The harness an agent runs is
// the board's, in ui.config.json; the model and the reasoning level under it are this
// machine's, so a checkout on another computer picks its own. Dotted and ignored, the same
// treatment .env gets.
export let LOCAL_CONFIG = ''
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
// The plans a discussion wrote (#427) — one file per plan, `<id>-<slug>.md`, numbered off
// next-id like a card. Tracked in git: a card's `## Source` names one, so a board that left
// its plans behind would carry cards pointing at nothing.
export let PLANS = ''
// Where a plan goes once the run it was handed to has written its cards (#551). Same file,
// one folder down, so `plans/` stays a short list of what is still live and the cards that
// name the plan in `## Source` are repointed at it here.
export let PLANS_ARCHIVE = ''
// One rule per agent, in the user's own words, appended to the end of every run that agent
// does (#306, #420) — `rules/<agent>.md`, named by a role the board ships or a specialist a
// card asks for. Tracked in git so a team shares them, and inside docs/kanban/, which every
// delivery worktree leaves out. Never created up front: a missing or empty file means the
// run goes unchanged.
export let RULES = ''
// What is waiting to be sorted (#453, #499, #559) — one Markdown file per item, directly
// under `triage/`. Three folders beside them say what has left the list: `archived/` once a
// card was made of it, `dismissed/` once somebody or an agent ignored it, and `files/` the
// bytes of anything dropped in, shared by all three. Tracked in git like the cards, and made
// by the first thing to land in it rather than by `init`: empty triage has no folder.
export let TRIAGE = ''
export let SIGNALS_ARCHIVED = ''
export let SIGNALS_DISMISSED = ''
export let SIGNALS_FILES = ''
// What a board written before #559 had: every item under `inbox/`, its dropped files under
// `inbox/files/`, and a `handled.md` listing the source ids that had left. Read only by the
// migration, which moves them into the four above and then removes them.
export let SIGNALS_OLD_INBOX = ''
export let SIGNALS_OLD_HANDLED = ''
// Delivery state that never belongs in git — #303's worktrees are the first thing in it.
// At the REPOSITORY root, not under docs/kanban/, because docs/kanban/.gitignore cannot
// reach outside its own folder — so this one line goes in the repo's own.
export let AKB_DIR = ''
export let ROOT_GITIGNORE = ''
export const AKB_IGNORE_LINE = '.akb/'

/** What this board's writing lock is called inside `.akb/`. Named after where the board sits
 *  in the project, because `.akb/` is the PROJECT's: two boards in one repository share the
 *  folder and must not share a lock, or working on one would make the other wait. */
function boardLockName(kanban: string, root: string): string {
  const from = path.relative(root, kanban)
  const name = from && !from.startsWith('..') ? from : path.basename(kanban)
  return `${name.split(path.sep).join('-')}.lock`
}

/** `.akb/`, made if it isn't there, with the repository's ignore line alongside it.
 *  Whatever a delivery needs on disk and must never commit goes in here — #303's worktrees
 *  first, and the board's own writing lock since #622. Nothing creates it up front: an
 *  empty ignored folder is a folder git wouldn't carry anyway.
 *
 *  The ignore line goes with the folder rather than beside each caller, because the lock is
 *  made by every write of the board — a repository that never delivered would otherwise have
 *  `.akb/` show up in `git status`. */
export function ensureAkbDir(): string {
  fs.mkdirSync(AKB_DIR, { recursive: true })
  writeRootIgnoreIfMissing()
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

/** Take that block back out — the other half of leaving Cloud (#317), so the cards the
 *  checkout gets back are cards git tracks. Only our own two lines go; the rest of the
 *  user's file is untouched. True when it removed one. */
export function unignoreBoardCopy(): boolean {
  if (!fs.existsSync(ROOT_GITIGNORE)) return false
  const lines = fs.readFileSync(ROOT_GITIGNORE, 'utf8').split('\n')
  const at = lines.findIndex((line) => line.trim() === COPY_IGNORE_LINE)
  if (at === -1) return false
  const from = at > 0 && lines[at - 1].startsWith('# This board lives in a Cloud workspace') ? at - 1 : at
  lines.splice(from, at - from + 1)
  fs.writeFileSync(ROOT_GITIGNORE, lines.join('\n'))
  return true
}

// The flag every hint the board prints for a person to paste back — follow it, stop it,
// resume it — carries, or the paste lands on whatever board the folder they are standing in
// has, which is usually the wrong one. ` --board <dir>` whenever the board was named,
// ` --dir <project>` when `--dir` named the project, empty otherwise.
export let BOARD_FLAG = ''

/** Where a board folder's project is: the nearest `.git` at or above it, else the board's
 *  parent. `.akb/` and the repository `.gitignore` are the project's, so two boards in one
 *  repository share them. */
export function projectRootOf(board: string): string {
  let dir = path.resolve(board)
  for (;;) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir
    const up = path.dirname(dir)
    if (up === dir) return path.dirname(path.resolve(board))
    dir = up
  }
}

// Point every path above at one board. Called once per command, before the command runs.
function setBoard(kanban: string, root: string, flag: string): string {
  REPO_ROOT = path.resolve(root)
  KANBAN = path.resolve(kanban)
  BOARD_FLAG = flag
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
  AGENTS = path.join(KANBAN, 'agents')
  LEGACY_AGENTS = path.join(KANBAN, 'skills')
  MEMORY = path.join(KANBAN, 'memory')
  AGENT_MEMORY = path.join(MEMORY, 'agents')
  GOAL = path.join(MEMORY, 'goal.md')
  UI_CONFIG = path.join(KANBAN, 'ui.config.json')
  LOCAL_CONFIG = path.join(KANBAN, '.local.json')
  ENV_FILE = path.join(KANBAN, '.env')
  // Everything from here on is machine state, under this board's own folder in the machine
  // home. Worked out here and made nowhere: `useProjectState` below is what puts the folder
  // on disk, so resolving a board never writes anything.
  const machine = projectStateDir(KANBAN)
  MOCKUPS = path.join(machine, MOCKUPS_FOLDER)
  COMMENTS = path.join(machine, COMMENTS_FOLDER)
  SESSIONS = path.join(machine, SESSIONS_FILE)
  SESSIONS_DIR = path.join(machine, SESSIONS_FOLDER)
  SESSIONS_LOCK = path.join(machine, SESSIONS_LOCK_NAME)
  CHATS_DIR = path.join(machine, CHATS_FOLDER)
  INDEX_LOCK = path.join(machine, INDEX_LOCK_NAME)
  DELIVERIES = path.join(KANBAN, 'deliveries')
  RULES = path.join(KANBAN, 'rules')
  PLANS = path.join(KANBAN, 'plans')
  PLANS_ARCHIVE = path.join(PLANS, 'archive')
  TRIAGE = path.join(KANBAN, 'triage')
  SIGNALS_ARCHIVED = path.join(TRIAGE, 'archived')
  SIGNALS_DISMISSED = path.join(TRIAGE, 'dismissed')
  SIGNALS_FILES = path.join(TRIAGE, 'files')
  SIGNALS_OLD_INBOX = path.join(TRIAGE, 'inbox')
  SIGNALS_OLD_HANDLED = path.join(TRIAGE, 'handled.md')
  AKB_DIR = path.join(REPO_ROOT, '.akb')
  ROOT_GITIGNORE = path.join(REPO_ROOT, '.gitignore')
  LOCK = path.join(AKB_DIR, boardLockName(KANBAN, REPO_ROOT))
  return REPO_ROOT
}

/** Point every path at `<root>/docs/kanban` — a project named by `--dir`, or found by the
 *  walk up. `named` is whether `--dir` chose it, which is what BOARD_FLAG reports. */
export function setBoardRoot(root: string, named = false): string {
  const project = path.resolve(root)
  return setBoard(path.join(project, 'docs', 'kanban'), project, named ? ` --dir ${project}` : '')
}

/** Point every path at a board folder named outright — `--board`, `AI4KANBAN_BOARD`, or a
 *  board the walk up found under its own name (#407). Every hint then carries `--board`,
 *  including for a board that happens to sit at `docs/kanban`: a paste has to reach the
 *  board this command was told to use, not the one its folder would find.
 *
 *  `root` is the project when the caller already knows it. Working it back out of the board
 *  folder is a guess — right for a repository, and one folder too deep for a project that
 *  is not one — so it is only the fallback. */
export function setBoardDir(board: string, root?: string): string {
  const folder = path.resolve(board)
  return setBoard(folder, root ?? projectRootOf(folder), ` --board ${folder}`)
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

/** A path as it is worth showing: from the project root when it is inside it, whole when it
 *  is not. The machine state a board keeps is outside every repository (#590), and
 *  `../../../.ai4kanban/...` is not a path anyone can act on. */
export const rel = (p: string): string => {
  const from = path.relative(REPO_ROOT, p)
  if (!from) return p
  return from.startsWith('..') ? p : from
}

/** This board's folder as the text an agent should read: `docs/kanban` on the default one,
 *  the real path on any other. The shipped flow text spells `docs/kanban` throughout, so
 *  every door that prints it swaps in the board it was asked about (#407) — otherwise an
 *  agent on `marketing/kanban` writes its memory into a folder nothing reads. */
export const BOARD_PATH_IN_TEXT = 'docs/kanban'

export function boardPath(): string {
  return rel(KANBAN).split(path.sep).join('/')
}

/** Where the drawings used to sit, as a shipped reference still spells it. They are machine
 *  state now (#590), so the literal is swapped for the real folder alongside the board swap
 *  above — an agent told to write into a folder nothing reads draws nothing. The `src` a card
 *  writes is untouched: it is a name, not a path, and the board resolves it. */
const MOCKUPS_PATH_IN_TEXT = 'docs/kanban/.mockups'

export function boardText(text: string): string {
  const drawn = text.split(MOCKUPS_PATH_IN_TEXT).join(rel(MOCKUPS))
  const here = boardPath()
  return here === BOARD_PATH_IN_TEXT ? drawn : drawn.split(BOARD_PATH_IN_TEXT).join(here)
}

export function readNextId(): number {
  if (!fs.existsSync(NEXT_ID)) die(`missing ${rel(NEXT_ID)}`, 'no-next-id')
  const value = fs.readFileSync(NEXT_ID, 'utf8').trim()
  if (!/^\d+$/.test(value)) die(`${rel(NEXT_ID)} is not a plain number: "${value}"`)
  return Number(value)
}

export function writeNextId(value: number): void {
  fs.writeFileSync(NEXT_ID, `${value}\n`)
}

/** Make this board's folder on the machine (#590). Called once per command, after the board
 *  is resolved and before it is read — and by the board UI server when it points the rules at
 *  its board, since nothing there goes through a command line. It touches nothing under the
 *  board folder: what a board held there before the move stays there, unread. */
export function useProjectState(): string {
  return ensureProjectState(KANBAN)
}
