// The one dispatcher behind every way of running a board move.
//
// `akb board <move>` and the `kanban.mjs` in an installed skill folder are two front doors
// onto this file — the rules live here once, so a fix reaches both without a second copy to
// keep in step.
//
// What it owns, and the commands below don't have to think about:
//   - which board to work on: `--dir <path>`, or the nearest one at or above the folder the
//     command was run in. Two boards at once never see each other's answers, because the
//     paths are set per call (lib/paths.mjs),
//   - handing the move to the board itself (lib/board/): what each move does, and the one
//     writer at a time that keeps two commands from handing out the same id, belong to the
//     board rather than to the command line in front of it,
//   - refusing without ending the process: a move throws, this catches, says why, and
//     returns an exit code (lib/io.mjs),
//   - answering a program instead of a person: `--json` puts the move's own fields, its
//     prose and its warnings in one object.

import fs from 'node:fs'
import path from 'node:path'

import { die, setBoardRoot, KANBAN } from './paths'
import { BoardError, say, startCollecting, stopCollecting, warn, type Sink } from './io'
import { board, boardState, moveTarget, openBoard, when, withLease } from './board'
import { readPointer } from './cloud/pointer'
import { BOARD_MOVES, READ_ONLY_MOVES } from './board/local'
import { flushOnExit } from './cloud/publish'
import { catchUpOnExit } from './cloud/requests'
import { insideRun } from './agent/env'
import { recordCreatedCards } from './agent/store'
import { boardHelp, findMove, legacyHelp, moveHelp, MOVE_NAMES } from './help'
import type { MoveOutput, OpResult } from './board'

// `init` is the one move that may run where no board exists yet — it is what makes one.
const MAKES_A_BOARD = 'init'

// ---- the shared options ----------------------------------------------------

export function splitShared(argv: string[]): { rest: string[]; dir: string | null; json: boolean } {
  const rest: string[] = []
  let dir: string | null = null
  let json = false
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg === '--dir') {
      dir = argv[++i] ?? null
      if (dir === null) die('--dir needs a path after it', 'bad-option')
    } else if (arg.startsWith('--dir=')) {
      dir = arg.slice('--dir='.length)
    } else if (arg === '--json') {
      json = true
    } else {
      rest.push(arg)
    }
  }
  return { rest, dir, json }
}

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

// A board with no `todo/` is half a board — a folder someone deleted from, or one an
// install never finished. Every move but `init` would fall over reading it, so it is
// turned away here with the one command that repairs it.
//
// A Cloud checkout is never half a board: its `docs/kanban/` is a copy, written whole by the
// hydration that happens after this, and a fresh clone has none at all.
function requireWholeBoard(root: string, move: string): string {
  if (move === MAKES_A_BOARD || pointsAtCloud(root)) return root
  if (!fs.existsSync(path.join(root, 'docs', 'kanban', 'todo'))) {
    die(`the board in ${root} has no docs/kanban/todo/ — run \`init\` to add what is missing.`, {
      kind: 'board-incomplete',
      dir: root,
    })
  }
  return root
}

// Walk up from `from` until a docs/kanban/ turns up. An agent's terminal is often a
// subfolder deep, and "run it from the repo root" is a rule that gets forgotten.
function findBoardUpward(from: string): string | null {
  let dir = path.resolve(from)
  for (;;) {
    if (hasBoard(dir)) return dir
    const up = path.dirname(dir)
    if (up === dir) return null
    dir = up
  }
}

export function resolveBoard(
  move: string,
  { dir, cwd, installHint }: { dir: string | null; cwd: string; installHint: string },
): string {
  if (dir !== null) {
    const root = path.resolve(dir)
    if (!fs.existsSync(root)) die(`no such folder: ${root}`, { kind: 'no-such-folder', dir: root })
    if (!hasBoard(root) && move !== MAKES_A_BOARD) {
      die(`no board in ${root} — it has no docs/kanban/. Run ${installHint} there to make one.`, {
        kind: 'no-board',
        dir: root,
      })
    }
    return requireWholeBoard(root, move)
  }
  const found = findBoardUpward(cwd)
  if (found) return requireWholeBoard(found, move)
  // `init` with nothing above it makes the board right here, which is what running it in a
  // fresh repo has always meant.
  if (move === MAKES_A_BOARD) return path.resolve(cwd)
  die(
    `no board here. Looked in ${path.resolve(cwd)} and every folder above it for docs/kanban/. ` +
      `Run ${installHint} to make one, or name the project with --dir.`,
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
  style?: 'board' | 'legacy'
  cwd?: string
  installHint?: string
  version?: string | null
  usage?: string
}

// Run one move and return the exit code. Never exits the process itself: the caller may be
// the CLI, a UI holding a run open, or a test, and none of them should die because one
// answer was wrong.
//
// Options:
//   program     how the command is spelled in messages ("akb board", "kanban")
//   style       'board' — the compact help; 'legacy' — the block installed skills print
//   cwd         where the command was run, for finding the board
//   installHint what to tell someone who has no board yet
//   version     what `version` prints; without it the move is not offered
//   usage       the Usage: line of the legacy help
export async function runBoard(argv: string[], options: RunBoardOptions = {}): Promise<number> {
  const {
    program = 'kanban',
    style = 'legacy',
    cwd = process.cwd(),
    installHint = '`akb install`',
    version = null,
    usage = 'node kanban.mjs <command> [args]',
  } = options

  // The move goes in front of a refusal only where the command has one ("akb board update:
  // …"). An installed skill folder has said plain "kanban: …" since it existed, and a board
  // installed before this landed must read exactly as it did.
  const withMove = style === 'board'

  // Seeded from a raw scan so that a refusal in the parse itself — `--dir` with nothing
  // after it — still answers in the form the caller asked for.
  let json = argv.includes('--json')
  let rest: string[] = []
  let dir: string | null = null
  try {
    ;({ rest, dir, json } = splitShared(argv))
  } catch (err) {
    return report(err, { program, json })
  }
  const [raw, ...args] = rest
  const help = () => (style === 'board' ? boardHelp(program) : legacyHelp(usage))

  // Help and version answer without a board — they are about the command, not a project.
  if (raw === undefined || raw === 'help' || raw === '--help' || raw === '-h') {
    const wanted = args[0] && findMove(args[0])
    if (args[0] && !wanted) return report(unknownMove(args[0]), { program, json, help: help() })
    say(wanted && style === 'board' ? moveHelp(wanted, program) : help())
    return 0
  }
  if (raw === 'version' || raw === '--version' || raw === '-v') {
    if (!version) {
      const err = new BoardError(`\`${program}\` has no version move — \`akb version\` prints it.`, {
        kind: 'unknown-move',
        move: raw,
      })
      return report(err, { program, json })
    }
    say(version)
    return 0
  }

  const found = findMove(raw)
  const move = found && BOARD_MOVES.has(found.name) ? found.name : null
  if (!move) return report(unknownMove(raw), { program, json, help: help() })

  const box = json ? startCollecting() : null
  try {
    const root = resolveBoard(move, { dir, cwd, installHint })
    setBoardRoot(root, dir !== null)
    // Which board this checkout opens — the folder, or the workspace a committed pointer
    // names (#316). A Cloud board that cannot be opened refuses here, in the words that say
    // what to do about it: sign in from the app, or point the checkout somewhere else.
    const opened = await openBoard(root)
    if (!opened.ok) die(opened.error, { kind: `cloud-${opened.reason}`, dir: root })
    sayIfOffline()
    // A read answers straight off the board. A write is one operation of the contract, under
    // a lease taken for it — whoever typed this never read the card, so the lease is what
    // hands them the revision they write against (lib/board/ops.ts).
    const owner = move === 'create' ? insideRun() : null
    const data = READ_ONLY_MOVES.has(move)
      ? await board().readMove(move, args)
      : unwrap(
          await withLease(moveTarget(move, args), async (env) => {
            const result = await board().runMove(move, args, env)
            // A cardless create run cannot hold its cards through `cardId`. Attach each new
            // id before giving the board lease back, so another close cannot adopt it first.
            if (result.ok && owner && Array.isArray(result.data.ids)) {
              recordCreatedCards(
                owner,
                result.data.ids.filter((id): id is number => Number.isInteger(id)),
              )
            }
            return result
          }),
        )
    // A board that ran the move somewhere else sends its prose back rather than printing it;
    // Local printed as it went and has none to add.
    const { output, warnings, ...fields } = data
    if (output) say(output)
    for (const line of (warnings as string[] | undefined) ?? []) warn(line)
    if (json) answer({ ok: true, board: KANBAN, ...fields, ...prose(box) })
    // A terminal command is over the moment it returns, so this is the outbox's one chance
    // to reach Cloud before the process ends (#319). Bounded, and silent either way: what
    // does not get out stays queued and is retried on the next write.
    await flushOnExit()
    // …and its one chance to claim an approval taken somewhere else (#318). A board whose
    // machine has no window open still runs its work the moment any command is run there.
    await catchUpOnExit()
    return 0
  } catch (err) {
    return report(err, { program, json, box, move: withMove ? move : null })
  } finally {
    if (json) stopCollecting()
  }
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

// What a mutation answered with, as the dispatcher needs it: the move's own fields, or the
// refusal thrown so the one reporter below turns it into a message and an exit code.
function unwrap(res: OpResult<{ data: MoveOutput }>): MoveOutput {
  if (res.ok) return res.data
  // A conflict reaches a terminal only when something else wrote the same card in the
  // milliseconds between the lease and the write. Reading it again is the whole fix, so
  // that is what it says.
  throw new BoardError(res.error, res.kind === 'conflict' ? { kind: 'conflict' } : { kind: 'refused' })
}

export const unknownMove = (raw: string): BoardError => {
  const guess = nearestMove(raw, MOVE_NAMES)
  return new BoardError(`unknown command "${raw}".${guess ? ` Did you mean \`${guess}\`?` : ''}`, {
    kind: 'unknown-move',
    move: raw,
  })
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

// A refused move says why and stops there. Prose goes to stderr with the move in front of
// it, so a terminal shows which command refused; --json puts the kind and whatever the
// refusal knows (an id, a track, a folder) where a caller can read them, next to the lines
// the move managed to print first — those are usually what explains the refusal.
export function report(
  err: unknown,
  {
    program,
    json,
    move = null,
    box = null,
    help = null,
  }: { program: string; json: boolean; move?: string | null; box?: Sink | null; help?: string | null },
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
    console.error(err.bare ? err.message : `${[program, move].filter(Boolean).join(' ')}: ${err.message}`)
    if (help) console.error(`\n${help}`)
  }
  return 1
}
