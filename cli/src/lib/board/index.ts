// ---- reaching the board -----------------------------------------------------
//
// `board()` is the one door. Everything that reads or writes a board goes through the
// provider it hands back — `akb board`, the app's screens, the run engine's own moves, and
// the board timer — so none of them knows or cares where the board actually is.
//
// There are two: Local, the markdown board in `docs/kanban/` (./local.ts), and Cloud, a
// board whose authority is a workspace and whose `docs/kanban/` is a copy of it (./cloud.ts).
// Which one a checkout gets is `./open.ts`'s answer, and nothing else in the codebase asks.

import type { BoardProvider, LeaseTarget, OpEnvelope, OpResult } from './contract'
import { localBoard } from './local'
import { leaseAnd } from './ops'

export * from './contract'
// The one read each screen makes, over the operations above (#374).
export * from './screen'
export { envelope, moveTarget, newOpId, opConflict, opOk, opRefused, leaseAnd } from './ops'
export { boardRevision, cardRevision, revisionOf } from './revision'
// Which board a checkout opens, how it stands, and the one re-read that is the user asking.
export { boardState, openBoard, refreshBoard } from './open'
export type { BoardState, OpenBoard, OpenRefusal } from './open'
// When a Cloud board's copy was read, in the one spelling a terminal and a browser both use.
export { when } from './cloud'
export type { CarryResult } from './cloud'
// What a run does around its board: its card's hold, the bracket it takes, and the one
// upload at its close (#398). Every one of them is a no-op on a Local board.
export {
  boardImage,
  carryRunEdits,
  dropRunCard,
  holdRunCard,
  rereadRunCard,
  runCanStart,
  takeRunCard,
} from './run'

let active: BoardProvider | null = null

/** The board this process is working on. */
export function board(): BoardProvider {
  if (!active) active = localBoard()
  return active
}

/** Point this process at a different board. `openBoard` (./open.ts) is what calls this on a
 *  checkout that points at a workspace; tests use it to stand a fake in front of the
 *  callers. */
export function setBoardProvider(provider: BoardProvider | null): void {
  active = provider
}

/** One mutation on this board, under a lease taken for it (see `leaseAnd`). */
export function withLease<T>(
  target: LeaseTarget,
  run: (env: OpEnvelope) => Promise<OpResult<T>>,
): Promise<OpResult<T>> {
  return leaseAnd(board(), target, run)
}

// ---- the writes a run makes around its own job ------------------------------
//
// The board owns every frontmatter field, so a run never writes one itself — it calls one
// of these. Each takes its own lease, because a run never read the card first.

export const setCardStatusOn = (id: number, status: string) =>
  withLease({ card: id }, (env) => board().setStatus(id, status, env))

export const appendCardQuestion = (id: number, question: string, options: string[]) =>
  withLease({ card: id }, (env) => board().appendQuestion(id, question, options, env))

export const archiveCard = (id: number) => withLease({ card: id }, (env) => board().archiveCard(id, env))

export const recordCardRun = (id: number) => withLease({ card: id }, (env) => board().recordRun(id, env))
