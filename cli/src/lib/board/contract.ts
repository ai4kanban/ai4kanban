// ---- the one contract every part of AI4Kanban reaches the board through -----
//
// One set of operations, one envelope, one conflict result. `akb raw`, the app's screens,
// the run engine and the board timer all call these and nothing else, so putting a team's
// board somewhere other than this machine is one more implementation of this file rather
// than a rewrite of each caller (#312).
//
// Three rules the shapes below exist to enforce:
//
//   • A READ may be a moment old. A snapshot is what a screen draws from, and a board
//     someone is mid-write on is still readable.
//   • A WRITE never is. Every mutation carries the revision the caller expects, and the
//     board refuses one written against a revision that has moved — as a CONFLICT, its own
//     result kind, so the caller re-reads that card instead of showing the user a sentence.
//   • A write has LANDED by the time its promise resolves. The calls are promise-returning
//     because a Cloud board is across a network, not because anything is queued: there is
//     no write buffer, no background flush, and no local copy applied first.
//
// A caller that never read the card — someone typing `akb raw update` — takes its
// expected revision from the writer LEASE it acquires. That is what makes "no blind writes"
// a rule the CLI can actually keep.
//
// This file is pure types and imports nothing that touches a filesystem, so it is copied
// into the board UI by scripts/sync-format.mjs and both sides name one contract.

import type { DeliveryCarryOn } from '../agent/types'
import type { Card } from '../view/types'

// ---- revisions -------------------------------------------------------------

/** What version of a resource a caller read. Opaque: Local derives it from the card file's
 *  content and Cloud will hand out its own, so nothing but equality may be read into it.
 *  It is never written into a card's portable frontmatter — it travels in the envelope. */
export type Revision = string

/** The revision of a resource that does not exist yet — what `create` expects to find. */
export const NO_REVISION: Revision = ''

// ---- the writer lease ------------------------------------------------------

/** A lease over one card, or over the board itself for the moves that are not about a
 *  single card (the project, a setup box). */
export type LeaseTarget = { card: number } | { board: true }

export type LeaseId = string

/** A granted lease, and the revision the board held when it was granted. That revision is
 *  what a caller who never read the resource writes against. */
export interface Lease {
  id: LeaseId
  target: LeaseTarget
  revision: Revision
}

export type LeaseResult = { ok: true; lease: Lease } | { ok: false; error: string }

// ---- the envelope every mutation carries -----------------------------------

/**
 * What rides alongside a mutation, never inside the card.
 *
 * `opId` names this ATTEMPT, so a board that lost the reply to one can recognise the retry
 * rather than doing the work twice. Local has no lost reply to recognise, so it only
 * records the id; spotting a duplicate is #314's.
 */
export interface OpEnvelope {
  opId: string
  /** The revision the caller read, or the one its lease handed it. */
  expect: Revision
  /** The lease held over the target. Card mutations require one. */
  lease?: LeaseId
}

// ---- what a mutation answers with ------------------------------------------

/** A mutation landed. `revision` is what the resource reads at now — a caller that writes
 *  again passes this back and never has to re-read. */
export type OpOk<T> = { ok: true; kind: 'ok'; revision: Revision } & T

/** The resource moved under the caller. Nothing was written. `current` is the revision the
 *  board holds now, so the caller can re-read that one resource and try again. */
export interface OpConflict {
  ok: false
  kind: 'conflict'
  error: string
  current: Revision
}

/** The board would not do it: an unknown card, a level that is not one of three, a
 *  lifecycle change its own rules refuse. Re-reading changes nothing. */
export interface OpRefused {
  ok: false
  kind: 'refused'
  error: string
}

export type OpResult<T = object> = OpOk<T> | OpConflict | OpRefused

/** Whatever fields the move itself hands back, which `--json` puts beside its prose. Named
 *  here rather than imported so this file keeps to the modules the UI shares. */
export interface BoardMoveData {
  [key: string]: unknown
}

/** What one `akb raw <move>` answers with: the move's own fields, and the prose it
 *  printed — held rather than written out, because the caller may be answering in JSON. */
export interface MoveOutput extends BoardMoveData {
  output?: string
  warnings?: string[]
}

/** A card mutation. The card is handed back as it now reads, so a screen redraws from what
 *  was written rather than from what it had. Absent when the card has left the board. */
export type CardOp = OpResult<{ card?: Card }>

// ---- the operations --------------------------------------------------------

export type BoardKind = 'local' | 'cloud'

/** Every read and every write of a board, in one interface. */
export interface BoardProvider {
  readonly kind: BoardKind

  readCards(): Promise<Card[]>

  // ---- the writer lease ----------------------------------------------------
  lease(target: LeaseTarget): Promise<LeaseResult>
  /** Give a lease back before it expires. Silent about one the board never granted. */
  releaseLease(id: LeaseId): Promise<void>

  // ---- a card's lifecycle and frontmatter ----------------------------------
  setStatus(id: number, status: string, env: OpEnvelope): Promise<CardOp>
  /** `options` are the choices the user ticks — two or more, as every question carries. */
  appendQuestion(id: number, question: string, options: string[], env: OpEnvelope): Promise<CardOp>
  archiveCard(id: number, env: OpEnvelope): Promise<OpResult<{ data: MoveOutput }>>
  rejectCard(id: number, env: OpEnvelope, how?: { reason?: string; discard?: boolean }): Promise<OpResult<{ data: MoveOutput }>>

  finishSetupStep(name: string, env: OpEnvelope): Promise<OpResult>

  // ---- the delivery lifecycle ----------------------------------------------
  cancelDelivery(deliveryId: string, env: OpEnvelope): Promise<OpResult<{ deliveryId?: string }>>
  /** Carry an ended delivery on from where it stopped (#639) — the one way back for a
   *  delivery that stopped short with its worktree and branch still here. It
   *  answers with where the delivery went: `landed` when its work turned out to be on the
   *  target branch already, `carryOn` with the step it picked back up otherwise. */
  resumeDelivery(
    deliveryId: string,
    env: OpEnvelope,
  ): Promise<OpResult<{ deliveryId?: string; landed?: boolean; carryOn?: DeliveryCarryOn }>>
  discardDelivery(deliveryId: string, env: OpEnvelope): Promise<OpResult<{ deliveryId?: string }>>

  // ---- the named `akb raw` moves -----------------------------------------
  /**
   * One board move, by the name a person types and what they typed after it.
   *
   * A Cloud board runs the move where the board is, and answers with the same fields and
   * the same prose. It is still a mutation like any other — envelope in, conflict out.
   *
   * Read-only moves take no envelope, which is what `readMove` is for.
   */
  runMove(move: string, input: MoveInput, env: OpEnvelope): Promise<OpResult<{ data: MoveOutput }>>
  readMove(move: string, input: MoveInput): Promise<MoveOutput>
}

/**
 * What a move was asked for, once the command line has been read.
 *
 * `args` is the positional arguments as typed — an id, a version. It is what
 * a lease target is read from (`moveTarget`), so it stays a plain list of words.
 * `opts` is the options, already validated by the command that declared them
 * (lib/cli/board.ts): a move never re-checks that `--priority` is one of three words.
 */
export interface MoveInput {
  args: string[]
  opts: Record<string, unknown>
}
