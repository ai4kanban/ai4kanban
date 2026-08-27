// ---- reaching the board -----------------------------------------------------
//
// `board()` is the one door. Everything that reads or writes a board goes through the
// provider it hands back — `akb board`, the app's screens, the run engine's own moves, and
// the board timer — so none of them knows or cares where the board actually is.
//
// Today there is one provider: Local, the markdown board in `docs/kanban/` (./local.ts).
// A board that lives elsewhere is one more implementation of `BoardProvider` and nothing
// else changed.

import type { BoardProvider, LeaseTarget, OpEnvelope, OpResult } from './contract'
import { localBoard } from './local'
import { leaseAnd } from './ops'

export * from './contract'
export { envelope, moveTarget, newOpId, opConflict, opOk, opRefused, leaseAnd } from './ops'
export { boardRevision, cardRevision, revisionOf } from './revision'

let active: BoardProvider | null = null

/** The board this process is working on. */
export function board(): BoardProvider {
  if (!active) active = localBoard()
  return active
}

/** Point this process at a different board. What #316 calls once a project is signed in to
 *  a Cloud board; tests use it to stand a fake in front of the callers. */
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
