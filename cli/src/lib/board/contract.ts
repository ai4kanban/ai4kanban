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

import type { AgentRequest, DeliveryRecord, FlowRuleView } from '../agent/types'
import type {
  ArchiveList,
  ArchivedCardFile,
  Board,
  BulkReleaseResult,
  Card,
  CardPatch,
  CardSchedule,
  ClosePlan,
  DeliveryDiff,
  DeliveryPlan,
  DropPlan,
  FillPlan,
  MemoryFile,
  MemoryModule,
  MetricsResult,
  SaveProjectResult,
  ScoreResult,
  SetupDraft,
  SetupState,
} from '../view/types'

// ---- revisions -------------------------------------------------------------

/** What version of a resource a caller read. Opaque: Local derives it from the card file's
 *  content and Cloud will hand out its own, so nothing but equality may be read into it.
 *  It is never written into a card's portable frontmatter — it travels in the envelope. */
export type Revision = string

/** The revision of a resource that does not exist yet — what `create` expects to find. */
export const NO_REVISION: Revision = ''

// ---- the writer lease ------------------------------------------------------

/** A lease over one card, or over the board itself for the moves that are not about a
 *  single card (a release, the project, a setup box). */
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

export const isConflict = (r: OpResult<never> | { ok: boolean; kind?: string }): r is OpConflict =>
  r.ok === false && (r as { kind?: string }).kind === 'conflict'

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

/** One card's list of hand-checks as it now stands (#276). */
export type VerifyOp = OpResult<{ verify: string[] }>

/** A card mutation. The card is handed back as it now reads, so a screen redraws from what
 *  was written rather than from what it had. Absent when the card has left the board. */
export type CardOp = OpResult<{ card?: Card }>

// ---- the operations --------------------------------------------------------

export type BoardKind = 'local' | 'cloud'

/**
 * Every read and every write of a board, in one interface.
 *
 * Grouped the way the work falls: snapshots, card reads, the lease, lifecycle and
 * frontmatter, releases, memory and setup, history, the delivery lifecycle, and the named
 * `akb raw` moves. Adding a board that lives elsewhere means one more class here.
 */
export interface BoardProvider {
  readonly kind: BoardKind

  // ---- snapshots and reads -------------------------------------------------
  readBoard(): Promise<Board>
  /** A short string that changes when anything the board draws does — what a screen polls
   *  so it re-reads only when something moved. */
  boardStamp(): Promise<string>
  readCard(id: number): Promise<Card | null>
  readCards(): Promise<Card[]>
  /** What `docs/kanban/.archive` holds — every finished card, newest first (#380). */
  readArchive(): Promise<ArchiveList>
  /** One archived card in full, or null when the archive holds none with that id. */
  readArchivedCard(id: number): Promise<ArchivedCardFile | null>
  readReleases(): Promise<string[]>
  readModules(): Promise<string[]>
  readGoalText(): Promise<string>
  readMemoryFile(name: string, module?: string): Promise<MemoryFile | null>
  /** The modules whose memory the panel can open, in the map's order. */
  readMemoryModules(): Promise<MemoryModule[]>
  readSetupState(): Promise<SetupState | null>
  readSetupDraft(): Promise<SetupDraft>
  readMetricsView(): Promise<MetricsResult>
  readScoreView(): Promise<ScoreResult>
  fillPlan(): Promise<FillPlan>
  closePlan(id: string): Promise<ClosePlan>
  dropPlan(id: string): Promise<DropPlan>
  /** What the board would start on its own this minute. It writes as it answers — the mark
   *  comes off a scheduled card in the same pass that hands its run back — so it is an
   *  operation, not a read. */
  nextWork(): Promise<AgentRequest[]>

  // ---- the writer lease ----------------------------------------------------
  lease(target: LeaseTarget): Promise<LeaseResult>
  /** Give a lease back before it expires. Silent about one the board never granted. */
  releaseLease(id: LeaseId): Promise<void>

  // ---- a card's lifecycle and frontmatter ----------------------------------
  patchCard(id: number, patch: CardPatch, env: OpEnvelope): Promise<CardOp>
  setStatus(id: number, status: string, env: OpEnvelope): Promise<CardOp>
  setSchedule(id: number, schedule: CardSchedule | null, env: OpEnvelope): Promise<CardOp>
  addVerify(id: number, line: string, env: OpEnvelope): Promise<VerifyOp>
  dropVerify(id: number, line: string, env: OpEnvelope): Promise<VerifyOp>
  /** `options` are the choices the user ticks — two or more, as every question carries. */
  appendQuestion(id: number, question: string, options: string[], env: OpEnvelope): Promise<CardOp>
  archiveCard(id: number, env: OpEnvelope): Promise<OpResult<{ data: MoveOutput }>>
  rejectCard(id: number, env: OpEnvelope): Promise<OpResult<{ data: MoveOutput }>>

  // ---- releases ------------------------------------------------------------
  setCardsRelease(ids: number[], release: string): Promise<BulkReleaseResult>
  newRelease(id: string, goal: string, fill: boolean, env: OpEnvelope): Promise<OpResult<{ fill: ReleaseFill }>>
  setReleaseGoal(id: string, goal: string, env: OpEnvelope): Promise<OpResult>
  closeRelease(id: string, env: OpEnvelope): Promise<OpResult<{ shipped: number }>>
  dropRelease(id: string, env: OpEnvelope): Promise<OpResult>

  // ---- memory, the goal and setup ------------------------------------------
  saveGoal(text: string, env: OpEnvelope): Promise<OpResult>
  saveProject(name: string, description: string, env: OpEnvelope): Promise<SaveProjectResult>
  finishSetupStep(name: string, env: OpEnvelope): Promise<OpResult>
  /** One of the four memory files, written whole — the project's copy, or a module's when
   *  `module` names one. Until #315 the only writer of a memory file was the coding agent
   *  editing it as a file, which a board that is not on this machine has no way to do. */
  saveMemoryFile(name: string, text: string, module: string, env: OpEnvelope): Promise<OpResult<{ file?: MemoryFile }>>

  // ---- the per-flow rules (#306) -------------------------------------------
  /** Every flow this board has, with the rule its agent carries (#420). The list is the
   *  board's own, so a flow shipped later appears without this being touched. */
  readFlowRules(): Promise<FlowRuleView[]>
  /** Save the rule of the agent that runs one flow. Empty text clears it, and the flows that
   *  agent also runs read the same rule afterwards. */
  saveFlowRule(command: string, text: string, env: OpEnvelope): Promise<OpResult>
  /** The rules a delivery freezes when it starts, keyed by the agent that carries each —
   *  read once, the way it reads the card it was approved to build. Editing a rule afterwards
   *  changes the next delivery, never one in flight. */
  deliveryRules(): Promise<Record<string, string>>

  // ---- history -------------------------------------------------------------
  /** Stamp one pass of a recurring card, which is what its cadence counts from. */
  recordRun(id: number, env: OpEnvelope): Promise<OpResult<{ data: MoveOutput }>>

  // ---- the delivery lifecycle ----------------------------------------------
  listDeliveries(): Promise<DeliveryRecord[]>
  activeDelivery(cardId: number): Promise<DeliveryRecord | undefined>
  deliveryPlan(): Promise<DeliveryPlan>
  deliveryDiff(deliveryId: string): Promise<DeliveryDiff | null>
  cancelDelivery(deliveryId: string, env: OpEnvelope): Promise<OpResult<{ deliveryId?: string }>>
  discardDelivery(deliveryId: string, env: OpEnvelope): Promise<OpResult<{ deliveryId?: string }>>
  approveDelivery(
    deliveryId: string,
    from: string,
    env: OpEnvelope,
  ): Promise<OpResult<{ deliveryId: string; covers: string }>>

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

/** How a new release was filled — the plain rule, or a run somebody still has to start. */
export type ReleaseFill = 'none' | 'fill' | 'agent'
