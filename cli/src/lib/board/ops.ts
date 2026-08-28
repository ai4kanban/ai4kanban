// ---- building and answering one operation ----------------------------------
//
// The small pieces every caller and every provider shares: how an envelope is minted, how a
// lease is taken around one write, which resource a named move writes, and the three shapes
// a mutation answers with.
//
// It knows nothing about any particular board — the provider is always passed in — so it
// can be imported from both sides without either one reaching back through the other.

import type { BoardProvider, LeaseTarget, OpConflict, OpEnvelope, OpOk, OpRefused, OpResult, Revision } from './contract'

let opCounter = 0

/** A fresh operation id. It names one ATTEMPT: a retry of the same write carries the same
 *  id, so a board that lost the reply to the first can tell the two apart (#314). The
 *  process, the clock and a counter, which is unique enough without a dependency. */
export function newOpId(): string {
  opCounter += 1
  return `${process.pid.toString(36)}-${Date.now().toString(36)}-${opCounter.toString(36)}`
}

/** The envelope for a caller that already read the resource it is about to write. */
export const envelope = (expect: Revision, lease?: string): OpEnvelope => ({ opId: newOpId(), expect, lease })

// ---- the three answers ------------------------------------------------------

export const opOk = <T extends object>(revision: Revision, extra: T): OpOk<T> =>
  ({ ok: true, kind: 'ok', revision, ...extra }) as OpOk<T>

export const opConflict = (current: Revision, what: string): OpConflict => ({
  ok: false,
  kind: 'conflict',
  error: `${what} changed since you read it — read it again and repeat the change.`,
  current,
})

export const opRefused = (error: unknown): OpRefused => ({
  ok: false,
  kind: 'refused',
  error: error instanceof Error ? error.message : String(error),
})

// ---- the writer lease -------------------------------------------------------

/**
 * Take a writer lease over `target`, run one mutation against the revision it hands back,
 * and give the lease up again.
 *
 * This is the whole answer to "a caller that did not read the card first". Someone typing
 * `akb board update 12 --status ready` never read #12, and refusing them for having no
 * revision would make the CLI unusable — so acquiring the lease IS their read.
 */
export async function leaseAnd<T>(
  provider: BoardProvider,
  target: LeaseTarget,
  run: (env: OpEnvelope) => Promise<OpResult<T>>,
): Promise<OpResult<T>> {
  const got = await provider.lease(target)
  if (!got.ok) return { ok: false, kind: 'refused', error: got.error }
  try {
    return await run(envelope(got.lease.revision, got.lease.id))
  } finally {
    await provider.releaseLease(got.lease.id)
  }
}

// ---- which resource a named move writes -------------------------------------

/** The `akb board` moves that name a card by its first numeric argument. Everything else is
 *  about the board itself — a release, the project's own files, a setup box. */
const CARD_MOVES = new Set([
  'update',
  'update-questions',
  'update-verify',
  'schedule',
  'tag',
  'archive',
  'reject',
  'record-run',
  'review-verdict',
  'run-blocker',
  'spec-write',
])

/** What one move writes, so its caller knows which lease to take. A card move whose id is
 *  missing or unreadable falls back to the board: the move itself is what refuses, and it
 *  says why far better than a lease could. */
export function moveTarget(move: string, args: string[]): LeaseTarget {
  if (!CARD_MOVES.has(move)) return { board: true }
  const id = Number(args.find((a) => /^\d+$/.test(a)))
  return Number.isInteger(id) && id > 0 ? { card: id } : { board: true }
}

/** What a conflict is about, for the line it carries. */
export const targetName = (target: LeaseTarget): string => ('card' in target ? `#${target.card}` : 'the board')

/** Whether two targets name the same resource — how a mutation tells a lease taken over
 *  what it is writing from one taken over something else. */
export const sameTarget = (a: LeaseTarget, b: LeaseTarget): boolean =>
  'card' in a ? 'card' in b && a.card === b.card : !('card' in b)
