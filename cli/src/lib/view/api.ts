// ---- the board, as a front end asks for it ---------------------------------
//
// One door onto everything a screen does with the board: read it, edit a card, plan and end
// a release, save the goal, tick a setup box, and ask what to start on its own.
//
// Every call here is one operation of the board's contract (../board/contract.ts) and
// nothing else — the same operations `akb board`, the run engine and the board timer use,
// so a button and a command can never disagree about what a card says. What this file adds
// is what a screen needs and the contract deliberately doesn't:
//
//   • the envelope. Every write takes a writer lease first. A dialog that read the card
//     passes the revision it read, and a stale edit comes back as a CONFLICT for the screen
//     to re-read; a control that read nothing writes against the lease's own revision.
//   • a refusal that does not throw. The caller is a dialog someone is still typing in, so
//     everything answers `{ ok, error }` and the dialog stays open on what they typed.
//
// Reads take no lock and may be a moment old. Writes never are: each one has landed on the
// authoritative board by the time its promise resolves.

import {
  board,
  envelope,
  opRefused,
  withLease,
  type CardOp,
  type OpEnvelope,
  type OpResult,
  type ReleaseFill,
  type Revision,
  type VerifyOp,
} from '../board'
import { asScheduledAction, SCHEDULED_ACTIONS } from '../schedule'
import type { BulkReleaseResult, CardPatch, SaveProjectResult, TrackDraft, WriteResult } from './types'

export type { ReleaseFill }

// ---- reads -----------------------------------------------------------------
//
// Named exactly as they were when they were plain functions, so the app and every caller
// read the same words; each one is now the contract's own read.

export const readBoard = () => board().readBoard()
export const boardStamp = () => board().boardStamp()
export const findCard = (id: number) => board().readCard(id)
export const allCards = () => board().readCards()
export const readArchive = () => board().readArchive()
export const readArchivedCard = (id: number) => board().readArchivedCard(id)
export const readSetupState = () => board().readSetupState()
export const readSetupDraft = () => board().readSetupDraft()
export const readModules = () => board().readModules()
export const readMetricsView = () => board().readMetricsView()
export const readScoreView = () => board().readScoreView()
export const readReleases = () => board().readReleases()
export const readGoalText = () => board().readGoalText()
export const readMemoryFile = (name: string, module = '') => board().readMemoryFile(name, module)
export const readMemoryModules = () => board().readMemoryModules()
export const readFlowRules = () => board().readFlowRules()
export const deliveryPlan = () => board().deliveryPlan()
export const deliveryDiff = (deliveryId: string) => board().deliveryDiff(deliveryId)
export const nextWork = () => board().nextWork()
export const fillPlan = () => board().fillPlan()
export const closePlan = (id: string) => board().closePlan(id)
export const dropPlan = (id: string) => board().dropPlan(id)

// ---- the envelope a screen writes with -------------------------------------

/** What a screen may hand in beside a change: the revision it read the card at, and the id
 *  of the attempt. Both optional — a control that read nothing gets a lease instead. */
export interface WriteOptions {
  expect?: Revision
  opId?: string
}

/** Run one mutation with an envelope. The lease is taken either way — no card is written
 *  without one — and what the write is checked against is the revision the screen read, or
 *  the lease's own for a control that read nothing. */
function envelopeFor<T>(
  target: { card: number } | { board: true },
  opts: WriteOptions | undefined,
  run: (env: OpEnvelope) => Promise<OpResult<T>>,
): Promise<OpResult<T>> {
  return answering(() =>
    withLease(target, (env) =>
      run({
        ...env,
        expect: opts?.expect ?? env.expect,
        opId: opts?.opId ?? env.opId,
      }),
    ),
  )
}

/** Every write here answers, none throws. A mutation refuses by returning, but taking the
 *  lease can still throw — a board another writer is holding is the one that matters — and
 *  a dialog someone is still typing in has to be told, not crashed. */
async function answering<T>(run: () => Promise<OpResult<T>>): Promise<OpResult<T>> {
  try {
    return await run()
  } catch (e) {
    return opRefused(e)
  }
}

/** Whatever a mutation answered with, flattened to the `{ ok, error }` a dialog reads —
 *  `kind` rides along, so a caller that cares can tell a stale read from a refusal. */
const flat = <T>(res: OpResult<T>): WriteResult & Partial<T> & { kind: string; current?: Revision } =>
  res as unknown as WriteResult & Partial<T> & { kind: string; current?: Revision }

// ---- a card ----------------------------------------------------------------

/** Apply a direct edit to one card: its title, body, priority, roi, release, cadence. */
export async function patchCard(id: number, patch: CardPatch, opts?: WriteOptions): Promise<WriteResult> {
  return flat(await envelopeFor({ card: id }, opts, (env) => board().patchCard(id, patch, env)))
}

/**
 * Add one hand-check to a card, or cross one off (#276) — the card page's two controls on
 * the **check by hand** panel.
 *
 * Both answer with the list as it now stands, so the screen redraws from what was written
 * rather than from what it had. Crossing one off names the LINE, not its place: a run can
 * add or take away hand-checks while the page sits open. A line that is no longer there
 * refuses, and the refusal is what the screen says.
 */
export async function addVerify(id: number, line: string, opts?: WriteOptions) {
  return flat<{ verify: string[] }>(
    (await envelopeFor({ card: id }, opts, (env) => board().addVerify(id, line, env))) as VerifyOp,
  )
}

export async function dropVerify(id: number, line: string, opts?: WriteOptions) {
  const res = flat<{ verify: string[] }>(
    (await envelopeFor({ card: id }, opts, (env) => board().dropVerify(id, line, env))) as VerifyOp,
  )
  if (res.ok) return res
  // Refused — most often because a run took that line off while the page sat open. Hand
  // back what the card holds now, so the panel redraws to the truth beside the message
  // rather than keeping a line that is no longer there.
  return { ...res, verify: (await board().readCard(id))?.verify }
}

/**
 * Schedule an action on a blocked card, so the board runs it by itself once the last card in
 * its way leaves the board.
 *
 * The action is checked here rather than trusted, so a stale screen can't write a mark
 * nothing will ever fire; everything else about whether this card may carry a schedule is
 * the board's own rule, and the refusal comes back as the line it wrote.
 */
export async function setSchedule(id: number, action: string, notes = '', opts?: WriteOptions): Promise<WriteResult> {
  const wanted = asScheduledAction(action)
  if (!wanted) {
    return { ok: false, error: `"${action}" isn't an action the board can schedule — ${SCHEDULED_ACTIONS.join(' or ')}.` }
  }
  const schedule = { action: wanted, notes: typeof notes === 'string' ? notes : '' }
  return flat(await envelopeFor({ card: id }, opts, (env) => board().setSchedule(id, schedule, env)))
}

/** Take a card's schedule off. Nothing fires after this. Silent about a card that had none:
 *  the button and the mark it takes off are drawn from a read that can be a moment old. */
export async function clearSchedule(id: number, opts?: WriteOptions): Promise<WriteResult> {
  return flat(await envelopeFor({ card: id }, opts, (env) => board().setSchedule(id, null, env)))
}

/**
 * Move several cards into one release, or back out of one.
 *
 * Each card is written on its own, under its own lease: one bad card must not cost the rest
 * their move, and the card files stay the record either way. The release is checked once,
 * before any card is written — a release that isn't on the list would fail every card for
 * the same reason, and a bar listing that message twenty times says less than one line
 * saying the release doesn't exist.
 */
export function setCardsRelease(ids: number[], release: string): Promise<BulkReleaseResult> {
  return board().setCardsRelease(ids, release)
}

// ---- releases --------------------------------------------------------------

/**
 * Start a release: one line appended to `docs/kanban/releases.md`, in ship order, carrying
 * what the version is for when one was given.
 *
 * `fill` asks for the release to be filled as it is made. Which way that happens is decided
 * by the board, not by the caller — a goal is what an agent can plan against, and a release
 * without one has nothing for an agent to decide, so it takes the plain rule instead.
 */
export async function newRelease(
  id: string,
  goal = '',
  fill = false,
  opts?: WriteOptions,
): Promise<WriteResult & { fill?: ReleaseFill }> {
  return flat<{ fill: ReleaseFill }>(
    await envelopeFor({ board: true }, opts, (env) => board().newRelease(id, goal, fill, env)),
  )
}

/** Change what a release is for, after it was made. An empty goal clears it — a release
 *  with no goal is a state the board works over, so unsaying it has to be possible too. */
export async function setReleaseGoal(id: string, goal: string, opts?: WriteOptions): Promise<WriteResult> {
  return flat(await envelopeFor({ board: true }, opts, (env) => board().setReleaseGoal(id, goal, env)))
}

/** Close a shipped release: one dated section in its summary file, the open cards' release
 *  cleared, the line off the list. `shipped` is how many cards the close counted, so the
 *  caller knows whether a changelog run has anything to write (#232). */
export async function closeRelease(id: string, opts?: WriteOptions): Promise<WriteResult & { shipped?: number }> {
  return flat<{ shipped: number }>(await envelopeFor({ board: true }, opts, (env) => board().closeRelease(id, env)))
}

/** Give up on a release: the open cards' release cleared and the line off the list, with no
 *  summary written. */
export async function dropRelease(id: string, opts?: WriteOptions): Promise<WriteResult> {
  return flat(await envelopeFor({ board: true }, opts, (env) => board().dropRelease(id, env)))
}

// ---- memory and the per-flow rules -----------------------------------------

/** Write one of the four memory files whole — the project's copy, or a module's when
 *  `module` names one. The board owns which names and which modules exist, so a name that
 *  is not one of the four comes back as a refusal rather than a new file. */
export async function saveMemoryFile(
  name: string,
  text: string,
  module = '',
  opts?: WriteOptions,
): Promise<WriteResult> {
  return flat(await envelopeFor({ board: true }, opts, (env) => board().saveMemoryFile(name, text, module, env)))
}

/** Save one flow's rule, in the user's own words. Empty text clears it — a flow with no
 *  rule and a flow with an empty rule are the same flow. */
export async function setFlowRule(command: string, text: string, opts?: WriteOptions): Promise<WriteResult> {
  return flat(await envelopeFor({ board: true }, opts, (env) => board().saveFlowRule(command, text, env)))
}

// ---- the goal and setup ----------------------------------------------------

/**
 * Save the project goal in the user's own words.
 *
 * Writing the goal IS setup's goal step, so a save ticks that box — one of the three the
 * board finishes itself. On a board with no checklist the tick is a no-op, which is the
 * whole of the "a goal judged weak long after setup" case.
 */
export async function saveGoal(text: string, opts?: WriteOptions): Promise<WriteResult> {
  return flat(await envelopeFor({ board: true }, opts, (env) => board().saveGoal(text, env)))
}

/** Save what the project is and what tracks its work falls into, and tick setup's `project`
 *  box. The tracks are folders as well as words, so this is also where a new one is made
 *  and an empty one that was dropped is removed. A track holding cards is kept and named in
 *  the answer rather than deleted. */
export async function saveProject(
  name: string,
  description: string,
  tracks: TrackDraft[],
): Promise<SaveProjectResult> {
  let lease: string | undefined
  try {
    const got = await board().lease({ board: true })
    if (!got.ok) return { ok: false, error: got.error }
    lease = got.lease.id
    return await board().saveProject(name, description, tracks, envelope(got.lease.revision, lease))
  } catch (e) {
    return { ok: false, error: opRefused(e).error }
  } finally {
    if (lease) await board().releaseLease(lease)
  }
}

/** Tick one setup box by name. Silent about a board with no checklist, an unknown step, or
 *  one already ticked: all three mean there is nothing to do, and a setup bar is a nudge,
 *  never something that should fail what the user actually asked for. */
export async function finishSetupStep(name: string, opts?: WriteOptions): Promise<WriteResult> {
  return flat(await envelopeFor({ board: true }, opts, (env) => board().finishSetupStep(name, env)))
}

// ---- the delivery lifecycle ------------------------------------------------
//
// The card page's Cancel delivery, Discard delivery and Approve this tree. They write the
// board, so they are the contract's operations like every other write a screen makes.

export async function cancelDelivery(deliveryId: string): Promise<WriteResult & { deliveryId?: string }> {
  return flat<{ deliveryId?: string }>(
    await answering(() => withLease({ board: true }, (env) => board().cancelDelivery(deliveryId, env))),
  )
}

export async function discardDelivery(deliveryId: string): Promise<WriteResult & { deliveryId?: string }> {
  return flat<{ deliveryId?: string }>(
    await answering(() => withLease({ board: true }, (env) => board().discardDelivery(deliveryId, env))),
  )
}

export async function approveDelivery(
  deliveryId: string,
  from = '',
): Promise<WriteResult & { deliveryId?: string; covers?: string }> {
  return flat<{ deliveryId: string; covers: string }>(
    await answering(() => withLease({ board: true }, (env) => board().approveDelivery(deliveryId, from, env))),
  )
}

export type { CardOp }
