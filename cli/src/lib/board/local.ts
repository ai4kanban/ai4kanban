// ---- the Local board -------------------------------------------------------
//
// The markdown board in `docs/kanban/`, behind the contract. Nothing about what a command
// writes or prints changed here: every operation below runs the code the board has always
// run, with three things done once on the way through.
//
//   • The board's writing lock is held around the file work, and only here. The promise
//     boundary sits ABOVE the lock, which is what makes a Local write literally synchronous
//     — the file is on disk before the call resolves.
//   • The caller's expected revision is checked against the file as it is at that moment,
//     inside the lock. A revision that has moved is a CONFLICT, never a half-applied write.
//   • Prose a move would have printed is swallowed for the typed operations, whose callers
//     read the value. The named `akb board` moves keep their prose: it is their answer, and
//     the dispatcher above owns where it lands.
//
// Local grants every lease, and no card is written without one. The lock is what serializes
// a single machine's board, so there is nothing here for a lease to fence off; the lease is
// what hands a caller who never read the card a revision to write against, and it is read
// under the same lock the write takes so that waiting for another writer hands out the
// revision that writer left behind rather than the one it was about to move.

import fs from 'node:fs'

import { approveDelivery } from '../agent/approval'
import { deliveryPlan } from '../agent/commit-mode'
import { activeDelivery, listDeliveries, settleManualCommit } from '../agent/deliveries'
import { cancelDelivery, discardDelivery } from '../agent/sessions'
import { cmdCreate, cmdSchedule, cmdTag, cmdUpdate, cmdUpdateQuestions, cmdUpdateVerify } from '../../commands/card'
import { cmdInit, cmdMemoryInit } from '../../commands/init'
import { cmdList } from '../../commands/list'
import { cmdMigrate, cmdRun } from '../../commands/misc'
import { cmdRelease } from '../../commands/release'
import { cmdRemove } from '../../commands/remove'
import { cmdRunBlocker } from '../../commands/run-blocker'
import { cmdSetupDone, cmdSetupStatus } from '../../commands/setup'
import { cmdSpecWrite } from '../../commands/spec-write'
import { afterBoardWrite } from '../cloud/publish'
import { quietly, say } from '../io'
import { withBoardLock } from '../lock'
import { METRICS, readNextId } from '../paths'
import {
  addRelease,
  closeRelease as closeReleaseMove,
  dropRelease as dropReleaseMove,
  endingCards,
  fillCandidates,
  fillRelease as fillReleaseMove,
  foldGoal,
  readReleases,
  setReleaseGoal as setReleaseGoalMove,
  type CardRow,
} from '../releases'
import { tickSetupStep } from '../setup'
import { deliveryDiff } from '../view/diff'
import { nextWork as dispatchNextWork } from '../view/dispatch'
import { addVerifyLine, dropVerifyLine, patchCard as patchCardWrite, setCardSchedule } from '../view/edit'
import { readModules, readSetupDraft, saveProject as saveProjectWrite } from '../view/first-run'
import { deliveryRules, readFlowRules, setFlowRule } from '../agent/rules'
import { readGoalText, writeGoalText } from '../view/goal'
import { readMemoryFile, readMemoryModules, writeMemoryFile } from '../view/memory'
import { readMetricsView } from '../view/metrics'
import { allCards, findCard, readBoard, readSetupState } from '../view/read'
import { readScoreView } from '../view/score'
import { boardStamp } from '../view/stamp'
import { NO_RELEASE, normalizeRelease } from '../validate'
import type {
  BoardProvider,
  Lease,
  LeaseId,
  LeaseResult,
  LeaseTarget,
  MoveOutput,
  OpConflict,
  OpEnvelope,
  OpRefused,
  OpResult,
  ReleaseFill,
  Revision,
  VerifyOp,
} from './contract'
import { leaseAnd, moveTarget, opConflict, opOk, opRefused, sameTarget, targetName } from './ops'
import { boardRevision, cardRevision } from './revision'
import type { BulkReleaseResult, CardPatch, CardSchedule, PlanCard, SaveProjectResult, TrackDraft } from '../view/types'

// ---- the named moves -------------------------------------------------------
//
// Lifted here from the dispatcher: `akb board <move>` is one operation of this contract,
// so the table of what each move does belongs to the board, not to the command line that
// happens to be in front of it today.

type RunMove = (rest: string[]) => MoveOutput | void

const MOVES: Record<string, RunMove> = {
  init: (rest) => cmdInit(rest),
  'memory-init': (rest) => cmdMemoryInit(rest[0]),
  'setup-done': (rest) => cmdSetupDone(rest),
  'setup-status': () => cmdSetupStatus(),
  create: (rest) => cmdCreate(rest),
  update: (rest) => cmdUpdate(rest),
  'update-questions': (rest) => cmdUpdateQuestions(rest),
  'update-verify': (rest) => cmdUpdateVerify(rest),
  schedule: (rest) => cmdSchedule(rest),
  tag: (rest) => cmdTag(rest),
  list: (rest) => cmdList(rest),
  release: (rest) => cmdRelease(rest),
  migrate: (rest) => cmdMigrate(rest),
  archive: (rest) => cmdRemove(Number(rest[0]), 'completed'),
  reject: (rest) => cmdRemove(Number(rest[0]), 'rejected'),
  'record-run': (rest) => cmdRun(Number(rest[0])),
  'spec-write': (rest) => cmdSpecWrite(rest),
  'run-blocker': (rest) => cmdRunBlocker(rest),
  peek: () => {
    const id = readNextId()
    say(String(id))
    return { next_id: id }
  },
  metrics: () => {
    const csv = fs.existsSync(METRICS) ? fs.readFileSync(METRICS, 'utf8').trim() : ''
    say(csv || '(no metrics yet)')
    return { csv }
  },
}

/** Every move this board answers to, by its canonical name. */
export const BOARD_MOVES: ReadonlySet<string> = new Set(Object.keys(MOVES))

/** The moves that only read. They take no lock and no envelope — nothing they do can be
 *  half-written, and a board someone is mid-write on is still readable. */
export const READ_ONLY_MOVES: ReadonlySet<string> = new Set(['list', 'peek', 'metrics', 'setup-status'])

// ---- the provider ----------------------------------------------------------

/** What the board reads at right now for the thing this operation writes. */
function revisionAt(target: LeaseTarget): Revision {
  return 'card' in target ? cardRevision(target.card) : boardRevision()
}

/** Every lease this process has out. Local grants them all; the record is what lets a
 *  mutation say the lease it was handed is one this board knows about. */
const leases = new Map<LeaseId, Lease>()
let leaseCounter = 0

/** The lease this envelope holds over `target`, or undefined for an envelope carrying none,
 *  one this board never granted, or one taken over something else. */
function leaseFor(env: OpEnvelope, target: LeaseTarget): Lease | undefined {
  const held = env.lease ? leases.get(env.lease) : undefined
  return held && sameTarget(held.target, target) ? held : undefined
}

/**
 * Whether this envelope may write `target`, given what the board reads at now.
 *
 * Two rules, and nothing may be written past either:
 *
 *   • A CARD needs a writer lease this board granted over it. That is what makes "no card is
 *     written without one" a check rather than a comment.
 *   • A revision that has moved is a CONFLICT — unless the caller's expectation is the one
 *     its own lease handed it. The lease's revision was read under this same lock, so a
 *     caller that waited out another writer is not stale, it is next in line; refusing it
 *     would turn every contended write into a refusal. A caller that read the resource
 *     ITSELF is still checked against it, which is what stops a stale screen overwriting.
 */
function checkWrite(target: LeaseTarget, env: OpEnvelope, current: Revision): OpRefused | OpConflict | null {
  const held = leaseFor(env, target)
  if ('card' in target && !held) {
    return opRefused(new Error(`${targetName(target)} cannot be written without a writer lease over it.`))
  }
  if (held && env.expect === held.revision) return null
  return env.expect === current ? null : opConflict(current, targetName(target))
}

export function localBoard(): BoardProvider {
  /**
   * One write, with the lock held and the caller's revision checked inside it.
   *
   * The check and the write are one critical section on purpose: a revision read outside
   * the lock could move before the write landed, which is the very race this exists to
   * catch. `fn` runs quietly — these callers read the value, and a board's stdout is not
   * theirs.
   */
  function mutate<T extends object>(target: LeaseTarget, env: OpEnvelope, fn: () => T): Promise<OpResult<T>> {
    try {
      const result = withBoardLock(() => {
        const no = checkWrite(target, env, revisionAt(target))
        if (no) return no
        const extra = quietly(fn)
        return opOk(revisionAt(target), extra)
      })
      // The board is on disk by the time the lock is let go; the publisher's outbox row is
      // written before this promise resolves (#319). Only the SEND is left running — nothing
      // on the board ever waits for the network.
      if (!result.ok) return Promise.resolve(result)
      return afterBoardWrite().then(() => result)
    } catch (e) {
      return Promise.resolve(opRefused(e))
    }
  }

  /** One read that may refuse, answered with a fallback where a screen has somewhere
   *  sensible to fall back to: an empty picker, an empty plan. */
  function read<T>(fn: () => T, fallback: T): Promise<T> {
    try {
      return Promise.resolve(quietly(fn))
    } catch {
      return Promise.resolve(fallback)
    }
  }

  const planCard = (card: CardRow): PlanCard => ({ id: card.id, title: card.title })

  const provider: BoardProvider = {
    kind: 'local',

    // ---- snapshots and reads -----------------------------------------------

    readBoard: () => Promise.resolve(readBoard()),
    boardStamp: () => Promise.resolve(boardStamp()),
    // The one awaited caller on the card page's read path, so the card's own writes hang
    // off it: a manual delivery the user has committed ends and archives its card HERE,
    // before the read, rather than from inside the read itself (#303).
    readCard: async (id) => {
      await settleManualCommit(id)
      return findCard(id)
    },
    readCards: () => Promise.resolve(allCards()),
    readReleases: () => read(readReleases, []),
    readModules: () => Promise.resolve(readModules()),
    readGoalText: () => Promise.resolve(readGoalText()),
    readMemoryFile: (name, module = '') => Promise.resolve(readMemoryFile(name, module)),
    readMemoryModules: () => Promise.resolve(readMemoryModules()),
    readSetupState: () => Promise.resolve(readSetupState()),
    readSetupDraft: () => Promise.resolve(readSetupDraft()),
    readMetricsView: () => Promise.resolve(readMetricsView()),
    readScoreView: () => Promise.resolve(readScoreView()),

    fillPlan: () =>
      read(
        () => {
          const { fill, skipped } = fillCandidates()
          return { fill: fill.map(planCard), skipped: skipped.map((c) => ({ ...planCard(c), reason: c.reason })) }
        },
        { fill: [], skipped: [] },
      ),

    closePlan: (id) =>
      read(
        () => {
          const { archived, left } = endingCards(id)
          return { left: left.map((c) => ({ ...planCard(c), done: c.done })), shipped: archived.length }
        },
        { left: [], shipped: 0 },
      ),

    dropPlan: (id) =>
      read(
        () => {
          const { archived, left } = endingCards(id)
          return { archived: archived.map(planCard), left: left.map(planCard) }
        },
        { archived: [], left: [] },
      ),

    // The board timer's one write goes through this contract like every other: the mark
    // comes off a scheduled card by the same operation a screen would use.
    nextWork: () =>
      dispatchNextWork(async (id) => {
        const res = await leaseAnd(provider, { card: id }, (env) => provider.setSchedule(id, null, env))
        return res.ok
      }),

    // ---- the writer lease ---------------------------------------------------

    // Local grants every lease, an unknown card included: a single machine's board is
    // already serialized by the writing lock, so there is nothing here to fence off — and
    // the operation itself refuses a card that isn't there in far better words than a lease
    // could. Fencing is Cloud's to enforce.
    //
    // The revision comes from inside the writing lock, so a lease taken while another writer
    // holds it waits and is granted at what that writer left behind. Read outside, it would
    // be the revision that writer was in the middle of moving, and the write it hands the
    // caller would refuse for a race the lock had already settled.
    lease(target: LeaseTarget): Promise<LeaseResult> {
      leaseCounter += 1
      const revision = withBoardLock(() => revisionAt(target))
      const lease: Lease = { id: `local-${leaseCounter.toString(36)}`, target, revision }
      leases.set(lease.id, lease)
      return Promise.resolve({ ok: true, lease })
    },

    releaseLease(id: LeaseId): Promise<void> {
      leases.delete(id)
      return Promise.resolve()
    },

    // ---- a card's lifecycle and frontmatter --------------------------------

    patchCard: (id, patch: CardPatch, env) =>
      mutate({ card: id }, env, () => {
        patchCardWrite(id, patch)
        return { card: findCard(id) ?? undefined }
      }),

    setStatus: (id, status, env) =>
      mutate({ card: id }, env, () => {
        cmdUpdate([String(id), '--status', status])
        return { card: findCard(id) ?? undefined }
      }),

    setSchedule: (id, schedule: CardSchedule | null, env) =>
      mutate({ card: id }, env, () => {
        setCardSchedule(id, schedule)
        return { card: findCard(id) ?? undefined }
      }),

    addVerify: (id, line, env): Promise<VerifyOp> =>
      mutate({ card: id }, env, () => ({ verify: addVerifyLine(id, line) })),

    dropVerify: (id, line, env): Promise<VerifyOp> =>
      mutate({ card: id }, env, () => ({ verify: dropVerifyLine(id, line) })),

    appendQuestion: (id, question, options, env) =>
      mutate({ card: id }, env, () => {
        cmdUpdateQuestions([String(id), '--append', question, ...options.flatMap((o) => ['--option', o])])
        return { card: findCard(id) ?? undefined }
      }),

    archiveCard: (id, env) => mutate({ card: id }, env, () => ({ data: cmdRemove(id, 'completed') || {} })),
    rejectCard: (id, env) => mutate({ card: id }, env, () => ({ data: cmdRemove(id, 'rejected') || {} })),

    // ---- releases -----------------------------------------------------------

    async setCardsRelease(ids: number[], release: string): Promise<BulkReleaseResult> {
      const target = normalizeRelease(release)
      if (target !== NO_RELEASE) {
        const known = await read(readReleases, [] as string[])
        if (!known.includes(target)) {
          return {
            moved: 0,
            failed: [],
            error: `unknown release "${target}" — releases on the list: ${known.join(', ') || '(none)'}.`,
          }
        }
      }
      const failed: { id: number; error: string }[] = []
      let moved = 0
      for (const id of ids) {
        // Each card is written on its own, under its own lease: one bad card must not cost
        // the rest their move, and the card files stay the record either way. A lease the
        // board would not grant throws where a mutation refuses, so it is caught here too.
        try {
          const res = await leaseAnd(provider, { card: id }, (env) => provider.patchCard(id, { release: target }, env))
          if (res.ok) moved += 1
          else failed.push({ id, error: res.error || 'could not be moved' })
        } catch (e) {
          failed.push({ id, error: opRefused(e).error })
        }
      }
      return { moved, failed }
    },

    newRelease: (id, goal, fill, env) =>
      mutate({ board: true }, env, () => {
        const made = addRelease(id, goal)
        if (!fill) return { fill: 'none' as ReleaseFill }
        // A goal is what an agent can plan against; a release without one takes the plain
        // rule instead, there and then.
        if (foldGoal(goal)) return { fill: 'agent' as ReleaseFill }
        fillReleaseMove(made)
        return { fill: 'fill' as ReleaseFill }
      }),

    setReleaseGoal: (id, goal, env) =>
      mutate({ board: true }, env, () => {
        setReleaseGoalMove(id.trim(), goal)
        return {}
      }),

    closeRelease: (id, env) =>
      mutate({ board: true }, env, () => ({ shipped: closeReleaseMove(id.trim()).shipped.length })),

    dropRelease: (id, env) =>
      mutate({ board: true }, env, () => {
        dropReleaseMove(id.trim())
        return {}
      }),

    // ---- memory, the goal and setup -----------------------------------------

    saveGoal(text: string, env: OpEnvelope) {
      if (typeof text !== 'string' || !text.trim()) {
        return Promise.resolve(opRefused(new Error('the goal must not be empty')))
      }
      return mutate({ board: true }, env, () => {
        writeGoalText(text)
        // Writing the goal IS setup's goal step. On a board with no checklist this is a
        // no-op, which is the whole of the "a goal judged weak long after setup" case.
        tickSetupStep('goal')
        return {}
      })
    },

    async saveProject(
      name: string,
      description: string,
      tracks: TrackDraft[],
      env: OpEnvelope,
    ): Promise<SaveProjectResult> {
      const res = await mutate({ board: true }, env, () => {
        const result = saveProjectWrite(name, description, tracks)
        // Saying what the project is IS setup's `project` step. It matters more than the
        // meter: setup starts at the first unticked box, so a box left open here is a run
        // that comes back and asks the repo what the user already answered.
        tickSetupStep('project')
        return result
      })
      if (!res.ok) return { ok: false, error: res.error }
      return { ok: true, added: res.added, renamed: res.renamed, keptBecauseUsed: res.keptBecauseUsed }
    },

    finishSetupStep: (name, env) =>
      mutate({ board: true }, env, () => {
        tickSetupStep(name)
        return {}
      }),

    // A memory file is one of the four, at one of two levels, and the board owns which:
    // a name or a module the reader would answer `null` for is refused here rather than
    // written to a path nobody would look at.
    saveMemoryFile: (name, text, module, env) =>
      mutate({ board: true }, env, () => {
        const file = writeMemoryFile(name, text, module)
        if (!file) throw new Error(`no memory file "${name}"${module ? ` for module ${module}` : ''}`)
        return { file }
      }),

    // ---- the per-flow rules -------------------------------------------------

    readFlowRules: () => Promise.resolve(readFlowRules()),

    // A rule is the board's, not one card's, so it is written under the board's own lease
    // like the module map and the release list beside it.
    saveFlowRule: (command, text, env) =>
      mutate({ board: true }, env, () => {
        const res = setFlowRule(command, text)
        if (!res.ok) throw new Error(res.error)
        return {}
      }),

    deliveryRules: () => Promise.resolve(deliveryRules()),

    // ---- history ------------------------------------------------------------

    recordRun: (id, env) => mutate({ card: id }, env, () => ({ data: cmdRun(id) || {} })),

    // ---- the delivery lifecycle ---------------------------------------------

    listDeliveries: () => Promise.resolve(listDeliveries()),
    activeDelivery: (cardId) => Promise.resolve(activeDelivery(cardId)),
    deliveryPlan: () => Promise.resolve(deliveryPlan()),
    deliveryDiff: (deliveryId) => Promise.resolve(deliveryDiff(deliveryId)),

    // Ending a delivery is mostly the delivery record's own work; the one board write in it
    // is handing the card back, and that goes through `setStatus` like every other. So the
    // revision is checked here and the board's lock is left to the operation that needs it,
    // rather than held across the git and record work in between.
    async cancelDelivery(deliveryId: string, env: OpEnvelope) {
      const no = checkWrite({ board: true }, env, boardRevision())
      if (no) return no
      const res = await cancelDelivery(deliveryId)
      if (!res.ok) return opRefused(new Error(res.error || 'the delivery could not be cancelled'))
      return opOk(boardRevision(), { deliveryId: res.deliveryId })
    },

    async discardDelivery(deliveryId: string, env: OpEnvelope) {
      const no = checkWrite({ board: true }, env, boardRevision())
      if (no) return no
      const res = await discardDelivery(deliveryId)
      if (!res.ok) return opRefused(new Error(res.error || 'the delivery could not be discarded'))
      return opOk(boardRevision(), { deliveryId: res.deliveryId })
    },

    approveDelivery: (deliveryId, from, env) =>
      mutate({ board: true }, env, () => {
        const res = approveDelivery(deliveryId, from)
        if (!res.ok) throw new Error(res.error)
        return { deliveryId: res.deliveryId, covers: res.covers }
      }),

    // ---- the named `akb board` moves ----------------------------------------

    runMove(move: string, args: string[], env: OpEnvelope) {
      const run = MOVES[move]
      if (!run) return Promise.resolve(opRefused(new Error(`unknown command "${move}".`)))
      // A move keeps its prose: it IS the move's answer, and the dispatcher above owns
      // where it lands — a terminal, or the `output` field of a --json answer.
      const target = moveTarget(move, args)
      try {
        const result = withBoardLock(() => {
          const no = checkWrite(target, env, revisionAt(target))
          if (no) return no
          const data = run(args) || {}
          return opOk(revisionAt(target), { data })
        })
        if (!result.ok) return Promise.resolve(result)
        return afterBoardWrite().then(() => result)
      } catch (e) {
        return Promise.reject(e)
      }
    },

    readMove(move: string, args: string[]): Promise<MoveOutput> {
      const run = MOVES[move]
      if (!run) return Promise.reject(new Error(`unknown command "${move}".`))
      try {
        return Promise.resolve(run(args) || {})
      } catch (e) {
        return Promise.reject(e)
      }
    },
  }

  return provider
}
