// The door onto `akb raw <move>`, and the parts of a command that are not the command.
//
// The moves themselves — what each one takes, what its options mean, and the help that is
// those two written down — are declared in lib/cli/board.ts. What lives here is what every
// door needs and no command should have to think about:
//
//   - which board to work on: `--board <dir>`, `--dir <path>`, or the nearest one at or
//     above the folder the command was run in. Two boards at once never see each other's
//     answers, because the paths are set per call (./paths.ts),
//   - refusing without ending the process: a command throws, `runProgram` catches, and
//     `report` below turns it into a line a person reads or an object a program does,
//   - answering a program instead of a person: `--json` puts the move's own fields, its
//     prose and its warnings in one object.

import fs from 'node:fs'
import path from 'node:path'

import { die, projectRootOf, setBoardDir, setBoardRoot } from './paths'
import { BoardError, warn, type Sink } from './io'
import { boardState, when } from './board'
import { readPointer } from './cloud/pointer'

// `init` is the one move that may run where no board exists yet — it is what makes one.
const MAKES_A_BOARD = 'init'

// ---- finding the board -----------------------------------------------------

// A board is a folder here, or a pointer at a workspace (#316). A fresh clone of a Cloud
// checkout carries no `docs/kanban/` at all — the copy is git-ignored and built on the first
// read — so the pointer is what says there is a board here to open.
//
// …except inside a delivery's worktree. The pointer is committed, so a worktree carries one,
// and opening the board there would hydrate a SECOND copy into a checkout that is meant to
// hold only code (#398). The project is the folder the walk finds next.
const hasBoard = (dir: string): boolean =>
  fs.existsSync(path.join(dir, 'docs', 'kanban')) || (readPointer(dir) !== null && !isDeliveryWorktree(dir))

// `.akb/worktrees/<cardId>/<deliveryId>` — where every delivery builds (agent/worktree.ts).
const isDeliveryWorktree = (dir: string): boolean => {
  const up = path.dirname(path.dirname(path.resolve(dir)))
  return path.basename(up) === 'worktrees' && path.basename(path.dirname(up)) === '.akb'
}

/** Whether this checkout's board lives in a workspace rather than in the folder. */
const pointsAtCloud = (root: string): boolean => readPointer(root) !== null

// A folder that IS a board rather than one that holds `docs/kanban` (#407) — `todo/` and
// `config.md` together, which is what every install writes and nothing else does. It is the
// same test `listBoards` uses, so a folder the switcher offers is one a command can open.
export const isBoardDir = (dir: string): boolean =>
  fs.existsSync(path.join(dir, 'todo')) && fs.existsSync(path.join(dir, 'config.md'))

/** Which board a command works on, and which project it belongs to. */
export interface FoundBoard {
  /** The project — where `.akb/` and the repository `.gitignore` live. */
  root: string
  /** The board folder itself. */
  board: string
  /** Whether `--board` or `AI4KANBAN_BOARD` named it, rather than the walk up finding it.
   *  A named board is named again in every hint the run prints (#407). */
  named?: boolean
}

/** The board named by `AI4KANBAN_BOARD`, or nothing. The flag beats it, and it is a
 *  relative path against the working directory the same way the flag is. */
const boardFromEnv = (): string | null => {
  const named = process.env.AI4KANBAN_BOARD?.trim()
  return named ? named : null
}

/** Point every path in ./paths.ts at what `resolveBoard` found. The project goes with the
 *  board: `resolveBoard` already worked it out, and letting `setBoardDir` guess it again
 *  would put `.akb/` a folder deep in a project that is not a git repository. */
export function useBoard(found: FoundBoard, dirNamed: boolean): void {
  if (!found.named && found.board === path.join(found.root, 'docs', 'kanban')) setBoardRoot(found.root, dirNamed)
  else setBoardDir(found.board, found.root)
}

// A board with no `todo/` is half a board — a folder someone deleted from, or one an
// install never finished. Every move but `init` would fall over reading it, so it is
// turned away here with the one command that repairs it.
//
// A Cloud checkout is never half a board: its `docs/kanban/` is a copy, written whole by the
// hydration that happens after this, and a fresh clone has none at all.
function whole(found: FoundBoard, move: string): FoundBoard {
  if (move === MAKES_A_BOARD || pointsAtCloud(found.root)) return found
  if (!fs.existsSync(path.join(found.board, 'todo'))) {
    die(`the board in ${found.board} has no todo/ — run \`init\` to add what is missing.`, {
      kind: 'board-incomplete',
      dir: found.root,
    })
  }
  return found
}

// Walk up from `from` until a board turns up. An agent's terminal is often a subfolder
// deep, and "run it from the repo root" is a rule that gets forgotten.
//
// A folder holding `docs/kanban/` is checked first, so the repo root of a project that also
// carries a second board still means the product board. A folder that IS a board answers
// second, which is what makes a command typed inside `marketing/kanban/` reach it (#407).
// Nothing guesses between two boards a folder merely sits above: `marketing/` finds the
// board over it, and naming the one you meant is what `--board` is for.
function findBoardUpward(from: string): FoundBoard | null {
  let dir = path.resolve(from)
  for (;;) {
    if (hasBoard(dir)) return { root: dir, board: path.join(dir, 'docs', 'kanban') }
    if (isBoardDir(dir)) return { root: projectRootOf(dir), board: dir }
    const up = path.dirname(dir)
    if (up === dir) return null
    dir = up
  }
}

export function resolveBoard(
  move: string,
  { board, dir, cwd, installHint }: { board?: string | null; dir: string | null; cwd: string; installHint: string },
): FoundBoard {
  // `--board` beats `AI4KANBAN_BOARD`, and both beat `--dir`, which is then ignored.
  const named = board ?? boardFromEnv()
  if (named) {
    const folder = path.resolve(cwd, named)
    if (!fs.existsSync(folder) && move !== MAKES_A_BOARD) {
      die(`no such folder: ${folder}`, { kind: 'no-such-folder', dir: folder })
    }
    if (fs.existsSync(folder) && !isBoardDir(folder) && move !== MAKES_A_BOARD) {
      die(`${folder} is not a board — it has no todo/ and config.md. Run ${installHint} --board ${named} to make one.`, {
        kind: 'no-board',
        dir: folder,
      })
    }
    return { root: projectRootOf(folder), board: folder, named: true }
  }
  if (dir !== null) {
    const root = path.resolve(dir)
    if (!fs.existsSync(root)) die(`no such folder: ${root}`, { kind: 'no-such-folder', dir: root })
    if (!hasBoard(root) && move !== MAKES_A_BOARD) {
      die(`no board in ${root} — it has no docs/kanban/. Run ${installHint} there to make one.`, {
        kind: 'no-board',
        dir: root,
      })
    }
    return whole({ root, board: path.join(root, 'docs', 'kanban') }, move)
  }
  const found = findBoardUpward(cwd)
  if (found) return whole(found, move)
  // `init` with nothing above it makes the board right here, which is what running it in a
  // fresh repo has always meant.
  if (move === MAKES_A_BOARD) return { root: path.resolve(cwd), board: path.join(path.resolve(cwd), 'docs', 'kanban') }
  die(
    `no board here. Looked in ${path.resolve(cwd)} and every folder above it for docs/kanban/. ` +
      `Run ${installHint} to make one, or name the board with --board.`,
    { kind: 'no-board', dir: path.resolve(cwd) },
  )
}

// ---- refusals --------------------------------------------------------------

// Levenshtein-based suggestion so a mistyped move auto-corrects to the closest match.
function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) dp[0]![j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i]![j] =
        a[i - 1] === b[j - 1] ? dp[i - 1]![j - 1]! : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!)
  return dp[a.length]![b.length]!
}

export function nearestMove(input: string, names: string[]): string | null {
  let best: string | null = null
  let bestDist = Infinity
  for (const c of names) {
    const d = editDistance(input, c)
    if (d < bestDist) [best, bestDist] = [c, d]
  }
  // Only suggest when it's a plausible typo, not a wildly different word.
  return best !== null && bestDist <= Math.max(2, Math.ceil(best.length / 2)) ? best : null
}

// ---- the entry point -------------------------------------------------------

// What the front door hands in — see the fields' notes below.
export interface RunBoardOptions {
  program?: string
  cwd?: string
  installHint?: string
  version?: string | null
  /** The move's own fields, handed over as it finishes — for a caller running a move
   *  in-process that wants the value rather than the text it printed. */
  onAnswer?: (data: Record<string, unknown>) => void
}

/**
 * Run one board move and return the exit code. Never exits the process itself: the caller
 * may be the CLI, a UI holding a run open, or a test, and none of them should die because
 * one answer was wrong.
 *
 * The tree, the options and the help all live in lib/cli/board.ts — this is only the door.
 *
 *   program     how the command is spelled in messages ("akb raw", "kanban")
 *   cwd         where the command was run, for finding the board
 *   installHint what to tell someone who has no board yet
 *   version     what `version` prints; without it the move refuses and names `akb version`
 */
export async function runBoard(argv: string[], options: RunBoardOptions = {}): Promise<number> {
  const {
    program = 'kanban',
    cwd = process.cwd(),
    installHint = '`akb install`',
    version = null,
    onAnswer,
  } = options
  const { buildBoardProgram } = await import('./cli/board')
  const { runProgram } = await import('./cli/shared')
  return runProgram(buildBoardProgram({ program, cwd, installHint, version, onAnswer }), argv, program)
}

/** Say the board is offline and how old the screen is, once, before the move answers. A
 *  read still answers from the copy; a write refuses in its own words (#316). */
export function sayIfOffline(): void {
  const state = boardState()
  if (!state.offline) return
  warn(
    `this board is offline — Cloud could not be reached. Showing the copy read ${when(state.readAt)}; ` +
      'nothing can be saved until Cloud answers.',
  )
}

export function prose(box: Sink | null): { output?: string; warnings?: string[] } {
  if (!box) return {}
  const out: { output?: string; warnings?: string[] } = {}
  if (box.out.length) out.output = box.out.join('\n')
  if (box.warnings.length) out.warnings = box.warnings
  return out
}

export function answer(object: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify(object) + '\n')
}

// A refused command says why and stops there. Prose goes to stderr with the command in
// front of it, so a terminal shows which one refused; --json puts the kind and whatever the
// refusal knows (an id, a folder) where a caller can read them, next to the lines
// the command managed to print first — those are usually what explains the refusal.
export function report(
  err: unknown,
  { program, json, box = null }: { program: string; json: boolean; box?: Sink | null },
): number {
  if (!(err instanceof BoardError)) {
    // Not a refusal — a bug. It still has to reach a caller that asked for JSON as JSON,
    // or the answer is an unparseable stack trace; the stack goes to stderr either way,
    // because a crash should stay loud.
    if (!json) throw err
    const bug = err as Error | undefined
    console.error(bug?.stack || String(err))
    answer({ ok: false, error: { kind: 'crashed', message: String(bug?.message || err) }, ...prose(box) })
    return 1
  }
  if (json) {
    answer({ ok: false, error: { kind: err.kind, message: err.message, ...err.details }, ...prose(box) })
  } else {
    console.error(err.bare ? err.message : `${program}: ${err.message}`)
  }
  return 1
}
