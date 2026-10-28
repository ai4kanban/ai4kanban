// ---- reaching the board -----------------------------------------------------
//
// `board()` is the one door. Everything that reads or writes a board goes through the
// provider it hands back — `akb raw` and the run engine's own moves — so neither knows or
// cares where the board actually is.
//
// Local, the markdown board in `docs/kanban/` (./local.ts), is the only one outside tests.

import type { BoardProvider, LeaseTarget, OpEnvelope, OpResult } from './contract'
import { localBoard } from './local'
import { leaseAnd, moveTarget } from './ops'

export * from './contract'
export { envelope, moveTarget, newOpId, opConflict, opOk, opRefused, leaseAnd } from './ops'
export { boardRevision, cardRevision, revisionOf } from './revision'

let active: BoardProvider | null = null

/** The board this process is working on. */
export function board(): BoardProvider {
  if (!active) active = localBoard()
  return active
}

/** Point this process at a different board. Tests use it to stand a fake in front of the
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

export const archiveCard = (id: number) => withLease({ card: id }, (env) => board().archiveCard(id, env))

export const finishSetupStep = (name: string) => withLease({ board: true }, (env) => board().finishSetupStep(name, env))

// `akb delivery cancel`, `resume` and `discard`.
export const cancelBoardDelivery = (id: string) => withLease({ board: true }, (env) => board().cancelDelivery(id, env))
export const resumeBoardDelivery = (id: string) => withLease({ board: true }, (env) => board().resumeDelivery(id, env))
export const discardBoardDelivery = (id: string) => withLease({ board: true }, (env) => board().discardDelivery(id, env))

/** One named `akb raw` move, run in process — for the board's own bookkeeping, where there
 *  is no command line to go through (lib/cli/board.ts) but the write still belongs to the
 *  board and still has to reach a Cloud workspace. */
export const runBoardMove = (move: string, args: string[], opts: Record<string, unknown> = {}) =>
  withLease(moveTarget(move, args), (env) => board().runMove(move, { args, opts }, env))
