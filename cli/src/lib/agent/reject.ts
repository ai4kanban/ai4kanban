// Rejecting a card is done on the spot (#1497): the holds a reject run used to pass, then the
// board's own move. Nothing is judged here — the rejection review learns from the reason later.

import { board, opRefused, withLease, type MoveOutput, type OpResult } from '../board'
import { rejectRefusal } from './sessions'
import type { RunRefusal } from './types'

export interface RejectHow {
  reason?: string
  /** A backlog clear-out (#601): the reason may be left off, and nothing learns from it. */
  discard?: boolean
}

export type RejectResult = OpResult<{ data: MoveOutput }> | ({ ok: false } & RunRefusal)

/** `receipt` keeps the move's prose, as `akb raw reject` does; a screen goes without. */
export async function rejectCard(id: number, how: RejectHow, receipt = false): Promise<RejectResult> {
  const held = rejectRefusal(id, how.discard === true)
  if (held) return { ok: false, ...held }
  try {
    return await withLease({ card: id }, (env) =>
      receipt
        ? board().runMove('reject', { args: [String(id)], opts: { ...how } }, env)
        : board().rejectCard(id, env, how),
    )
  } catch (e) {
    return opRefused(e)
  }
}
