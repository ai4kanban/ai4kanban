// docs/kanban/.sessions.json — the live record every process on this board shares.
//
// It holds two lists and a set of marks. The RUNS are agent invocations: what is running,
// and what ran lately. The DELIVERIES are the jobs those runs belong to — one Implement
// click each, and several runs long. The MARKS say how far each card has been accounted
// for, so two runs never both claim one edit (agent/refine.ts). All three live in a file
// rather than in memory because the processes that need them are not one process: a run
// started from a terminal, one started from a button, and one the board started on its own
// all land in the same lists, and the rules that hold a card still hold across all three.
//
// Nothing is kept between commands: every read is a read of the file, and every write
// takes the record's own lock.
//
// That lock is NOT the board's writing lock. A run's bookkeeping calls board moves —
// putting a card's stage back, stamping a recurring card — and those take the board lock
// themselves, so holding it here would deadlock.

import fs from 'node:fs'
import path from 'node:path'

import { pidAlive, withLock } from '../lock'
import { SESSIONS, SESSIONS_DIR, SESSIONS_LOCK } from '../paths'
import { asUsage } from './log'
import type {
  AgentAction,
  DeliveryApproval,
  DeliveryLanding,
  DeliveryRecord,
  DeliveryReview,
  DeliveryStatus,
  DeliveryStep,
  ExecutionBlocker,
  LandingStatus,
  ReviewStopReason,
  ReviewVerdict,
  RunRecord,
  RunStatus,
} from './types'

/** How many finished runs the record keeps. Match KEEP_LOGS: a run whose log is gone is
 *  dropped here too, so the smaller of the two is what the Run dialog actually shows. */
const KEEP_RUNS = 100

// And how many ended deliveries. Far fewer are needed here than runs: this row is only
// the live copy, and the permanent one is the file under docs/kanban/deliveries/, which is
// tracked in git and never pruned.
const KEEP_DELIVERIES = 30

/** Where a run's log is written, from its id alone. */
export const logPathOf = (sessionId: string): string => path.join(SESSIONS_DIR, `${sessionId}.log`)

// Names the clarify session went by in older builds: the whole refine flow as one action,
// then `raise-questions`. A board's history outlives a version, so those records stay
// readable.
const WAS_CLARIFY = new Set(['auto-refine', 'refine', 'raise-questions'])

export const readAction = (action: unknown): AgentAction =>
  typeof action === 'string' && WAS_CLARIFY.has(action) ? 'clarify' : (action as AgentAction)

/** Everything the file holds. */
export interface Store {
  runs: RunRecord[]
  deliveries: DeliveryRecord[]
  /** One board mark per card, by id: the card as the last run to close over it left it.
   *  A change is claimed once, by the first close that sees it — see `claimChanges` in
   *  agent/refine.ts, which is the only thing that reads or writes this. */
  marks: Record<string, string>
}

/** Everything the record holds, newest last. Reads only — no lock, because a half-written
 *  file is never what a reader sees: every write is atomic (write, then rename). */
export function readStore(): Store {
  let data: unknown
  try {
    data = JSON.parse(fs.readFileSync(SESSIONS, 'utf8'))
  } catch {
    return { runs: [], deliveries: [], marks: {} }
  }
  const box = data as {
    runs?: unknown
    live?: unknown
    finished?: unknown
    deliveries?: unknown
    marks?: unknown
  }
  // `live`/`finished` is the shape the board UI's own registry wrote before the record
  // became everyone's. Read so an upgrade mid-run keeps its history.
  const raw = Array.isArray(box?.runs)
    ? box.runs
    : [...(Array.isArray(box?.live) ? box.live : []), ...(Array.isArray(box?.finished) ? box.finished : [])]
  const runs: RunRecord[] = []
  for (const entry of raw as Partial<RunRecord>[]) {
    if (!entry || typeof entry.sessionId !== 'string' || !entry.sessionId) continue
    runs.push({
      sessionId: entry.sessionId,
      cardId: typeof entry.cardId === 'number' ? entry.cardId : null,
      createdCardIds: Array.isArray(entry.createdCardIds)
        ? [...new Set(entry.createdCardIds.filter((id): id is number => Number.isInteger(id) && id > 0))]
        : undefined,
      action: readAction(entry.action),
      status: asStatus(entry.status),
      startedAt: typeof entry.startedAt === 'number' ? entry.startedAt : Date.now(),
      endedAt: typeof entry.endedAt === 'number' ? entry.endedAt : undefined,
      pid: typeof entry.pid === 'number' ? entry.pid : undefined,
      input: typeof entry.input === 'string' ? entry.input : undefined,
      ok: typeof entry.ok === 'boolean' ? entry.ok : undefined,
      code: entry.code ?? null,
      error: typeof entry.error === 'string' ? entry.error : undefined,
      blocker: readBlocker(entry.blocker),
      // A run that never reported a cost shows none, rather than a zero it didn't earn.
      costUsd: typeof entry.costUsd === 'number' && entry.costUsd > 0 ? entry.costUsd : undefined,
      usage: asUsage(entry.usage),
      model: typeof entry.model === 'string' && entry.model ? entry.model : undefined,
      result: typeof entry.result === 'string' ? entry.result : undefined,
      note: typeof entry.note === 'string' && entry.note ? entry.note : undefined,
      // A run written down before the agent was recorded carries no name, so it gets no
      // resume: every agent resumes differently, and the one thing worse than a missing
      // offer is a command for the wrong agent.
      harness: typeof entry.harness === 'string' ? entry.harness : '',
      resumeId: typeof entry.resumeId === 'string' ? entry.resumeId : undefined,
      logPath: typeof entry.logPath === 'string' && entry.logPath ? entry.logPath : logPathOf(entry.sessionId),
      resumedFrom: typeof entry.resumedFrom === 'string' ? entry.resumedFrom : undefined,
      priorStatus: typeof entry.priorStatus === 'string' ? entry.priorStatus : undefined,
      stopping: entry.stopping === true ? true : undefined,
      specAgent: typeof entry.specAgent === 'string' && entry.specAgent ? entry.specAgent : undefined,
      refineRound:
        typeof entry.refineRound === 'number' && Number.isInteger(entry.refineRound) && entry.refineRound >= 0
          ? entry.refineRound
          : undefined,
      refineEffort:
        entry.refineEffort === 'lightweight' || entry.refineEffort === 'standard'
          ? entry.refineEffort
          : undefined,
      flowId: typeof entry.flowId === 'string' && entry.flowId ? entry.flowId : undefined,
      deliveryId: typeof entry.deliveryId === 'string' && entry.deliveryId ? entry.deliveryId : undefined,
    })
  }
  runs.sort((a, b) => a.startedAt - b.startedAt)
  return { runs, deliveries: readDeliveryRows(box?.deliveries), marks: readMarks(box?.marks) }
}

// A board written by a copy of these rules from before marks existed has none, and reads as
// a board nothing has accounted for yet — the first close after the upgrade takes what it
// finds and every one after that reads its own mark back.
function readMarks(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const marks: Record<string, string> = {}
  for (const [id, mark] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof mark === 'string' && mark) marks[id] = mark
  }
  return marks
}

/** Every run the record holds, newest last. */
export const readRuns = (): RunRecord[] => readStore().runs

/** A run that has been written down but whose watcher hasn't reported its pid yet. Anything
 *  older than this with no pid was never really started — the command died between writing
 *  the record and spawning — so it stops counting as live. */
export const PENDING_MS = 30_000

/** Is this run working right now? `reap`'s own test (agent/sessions.ts) without the write,
 *  so a reader and a reaper never disagree about which runs are live. */
export const runIsLive = (run: RunRecord): boolean =>
  run.status === 'running' &&
  (run.pid ? pidAlive(run.pid) : Date.now() - run.startedAt < PENDING_MS)

/** The run working this board right now, or nothing when the machine is quiet.
 *
 *  A Cloud board asks it before it refreshes its copy: `docs/kanban/` is one folder shared by
 *  every process here, so reading the workspace over it while a run is mid-edit would put the
 *  workspace's cards over what the agent has typed and not yet uploaded (#398). */
export const workingRun = (): RunRecord | undefined => readRuns().find(runIsLive)

/** The cards live runs OTHER than this one are holding — theirs to upload when they close,
 *  which is what keeps a run's own close from sending a neighbour's half-written card (#398).
 *
 *  A spec run holds nothing: it fills one section while the card's own loop carries on around
 *  it, the rule `lockedBy` and `claimChanges` both follow. */
export function cardsHeldElsewhere(sessionId: string): Set<number> {
  const held = new Set<number>()
  for (const run of readRuns()) {
    if (run.sessionId === sessionId || run.action === 'spec' || !runIsLive(run)) continue
    if (run.cardId !== null) held.add(run.cardId)
    for (const id of run.createdCardIds ?? []) held.add(id)
  }
  return held
}

/**
 * Every card the board is working on this second.
 *
 * A live run holds the card it names, and so does a delivery between its runs — a card being
 * rewritten is not one waiting for a person, whatever it happens to say mid-run. One answer
 * off one record, so the rule that decides what Cloud raises (../cloud/snapshot.ts) is the
 * same rule that decides what may start.
 *
 * A spec run holds nothing: it fills one section of the card and never the plan, which is
 * what `lockedBy` already says.
 */
export function cardsAtWork(): Set<number> {
  const store = readStore()
  const held = new Set<number>()
  for (const run of store.runs) {
    if (run.cardId === null || run.action === 'spec') continue
    if (runIsLive(run)) held.add(run.cardId)
  }
  for (const delivery of store.deliveries) {
    if (delivery.status === 'active') held.add(delivery.cardId)
  }
  return held
}

/** Attach the one interruption a person must clear before this implementation resumes. */
export function recordRunBlocker(
  cardId: number,
  sessionId: string,
  blocker: ExecutionBlocker,
): { ok: true; run: RunRecord } | { ok: false; error: string } {
  return withRuns((runs) => {
    const run = runs.find((r) => r.sessionId === sessionId)
    if (!run || run.status !== 'running') return { ok: false, error: 'no active run can record this blocker' }
    if (run.action !== 'implement') return { ok: false, error: 'only an implementation run can record a blocker' }
    if (run.cardId !== cardId) return { ok: false, error: `this run is implementing #${run.cardId}, not #${cardId}` }
    run.blocker = blocker
    return { ok: true, run: { ...run } }
  })
}

function readDeliveryRows(raw: unknown): DeliveryRecord[] {
  if (!Array.isArray(raw)) return []
  const rows: DeliveryRecord[] = []
  for (const entry of raw as Partial<DeliveryRecord>[]) {
    if (!entry || typeof entry.deliveryId !== 'string' || !entry.deliveryId) continue
    if (!Number.isInteger(entry.cardId)) continue
    rows.push({
      deliveryId: entry.deliveryId,
      cardId: entry.cardId as number,
      title: typeof entry.title === 'string' ? entry.title : '',
      status: asDeliveryStatus(entry.status),
      startedAt: typeof entry.startedAt === 'number' ? entry.startedAt : Date.now(),
      endedAt: typeof entry.endedAt === 'number' ? entry.endedAt : undefined,
      sessions: Array.isArray(entry.sessions) ? entry.sessions.filter((s) => typeof s === 'string') : [],
      approved: typeof entry.approved === 'string' ? entry.approved : '',
      initialQuestions:
        typeof entry.initialQuestions === 'number' && entry.initialQuestions >= 0
          ? Math.floor(entry.initialQuestions)
          : undefined,
      steps: readSteps(entry.steps),
      base: typeof entry.base === 'string' && entry.base ? entry.base : undefined,
      review: readReview(entry.review),
      priorStatus: typeof entry.priorStatus === 'string' && entry.priorStatus ? entry.priorStatus : undefined,
      // An older delivery may have been waiting to start a correction. The combined flow
      // resumes it as review, which sees and fixes that round's findings itself.
      next: entry.next === 'review' || entry.next === 'correct' ? 'review' : undefined,
      // A delivery written down before #303 names no mode. It ran in the user's checkout
      // with no worktree, which is exactly what manual commit mode is — so that is what it
      // reads as, rather than a worktree nothing ever made.
      commitMode: entry.commitMode === 'auto' ? 'auto' : entry.commitMode === 'manual' ? 'manual' : undefined,
      manualWhy: text(entry.manualWhy),
      targetBranch: text(entry.targetBranch),
      worktree: text(entry.worktree),
      branch: text(entry.branch),
      reviewed: readReviewed(entry.reviewed),
      landing: readLanding(entry.landing),
      // Whether this delivery has to be approved before it lands, and the approval it has
      // (#308). A delivery written down before diff approval existed needs none.
      approval: readApproval(entry.approval),
      // The flow rules this delivery froze (#306). A delivery written down before they
      // existed has none, and its runs read the files — which is what they always did.
      rules: readRules(entry.rules),
    })
  }
  return rows.sort((a, b) => a.startedAt - b.startedAt)
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined

function readBlocker(raw: unknown): RunRecord['blocker'] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const box = raw as Record<string, unknown>
  const step = text(box.step)
  const cause = text(box.cause)
  const unblock = text(box.unblock)
  return step && cause && unblock ? { step, cause, unblock } : undefined
}

// The rules a delivery froze, keyed by the command that starts the flow. An empty object is
// kept and undefined is not: `{}` means this delivery froze rules and none were set, while
// nothing at all means a delivery from before rules existed, whose runs read the files.
function readRules(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const rules: Record<string, string> = {}
  for (const [command, rule] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof rule === 'string' && rule) rules[command] = rule
  }
  return rules
}

// What review passed in manual commit mode (#303), so the user's own commit can be matched
// against it. A snapshot with no fingerprint is no snapshot at all.
function readReviewed(raw: unknown): DeliveryRecord['reviewed'] {
  if (!raw || typeof raw !== 'object') return undefined
  const box = raw as { mark?: unknown; diff?: unknown; at?: unknown }
  const mark = text(box.mark)
  if (!mark) return undefined
  return { mark, diff: text(box.diff), at: typeof box.at === 'number' ? box.at : 0 }
}

// Where this delivery stands on landing (#304). A status we can't read is `waiting`: it
// claims nothing, and a delivery wrongly reading as the slot's holder would stop every
// other card on the board.
function readLanding(raw: unknown): DeliveryRecord['landing'] {
  if (!raw || typeof raw !== 'object') return undefined
  const box = raw as Partial<DeliveryLanding>
  const num = (value: unknown): number | undefined => (typeof value === 'number' ? value : undefined)
  return {
    status: asLandingStatus(box.status),
    why: text(box.why),
    attempts: typeof box.attempts === 'number' && box.attempts > 0 ? Math.floor(box.attempts) : 0,
    rebasedAt: num(box.rebasedAt),
    commit: text(box.commit),
    onto: text(box.onto),
    overlap: Array.isArray(box.overlap) ? box.overlap.filter((n) => Number.isInteger(n)) : undefined,
    checks: Array.isArray(box.checks)
      ? box.checks.flatMap((c) =>
          c && typeof c.name === 'string' ? [{ name: c.name, ok: c.ok === true, at: num(c.at) ?? 0 }] : [],
        )
      : undefined,
    at: num(box.at) ?? 0,
  }
}

const asLandingStatus = (value: unknown): LandingStatus =>
  value === 'landing' || value === 'landed' || value === 'conflict' ? value : 'waiting'

// This delivery's diff approval (#308). Undefined and `{ required: false }` are not the same
// thing to write, but they hold a delivery back exactly as much as each other — nothing — so
// a record from before the setting existed reads as needing none.
function readApproval(raw: unknown): DeliveryRecord['approval'] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const box = raw as Partial<DeliveryApproval>
  const num = (value: unknown): number => (typeof value === 'number' ? value : 0)
  const granted = box.granted && typeof box.granted === 'object' ? box.granted : undefined
  return {
    required: box.required === true,
    granted: granted
      ? { base: text(granted.base), mark: text(granted.mark), from: text(granted.from), at: num(granted.at) }
      : undefined,
    events: Array.isArray(box.events)
      ? box.events.flatMap((e) =>
          e && (e.kind === 'approved' || e.kind === 'cancelled')
            ? [
                {
                  kind: e.kind,
                  base: text(e.base),
                  mark: text(e.mark),
                  moved: e.moved === 'base' || e.moved === 'tree' ? e.moved : undefined,
                  from: text(e.from),
                  at: num(e.at),
                },
              ]
            : [],
        )
      : [],
  }
}

// What review has said about this delivery (#302). Rebuilt field by field like everything
// else here, so a record written by an older copy of these rules still reads — it simply
// has no review on it, which is the truth about a delivery that ran before review existed.
function readReview(raw: unknown): DeliveryReview | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const box = raw as Partial<DeliveryReview>
  const rounds = Array.isArray(box.rounds) ? box.rounds : []
  const stop = box.stopped
  return {
    rounds: rounds.flatMap((r) =>
      r && typeof r.sessionId === 'string' && isVerdict(r.verdict)
        ? [
            {
              sessionId: r.sessionId,
              verdict: r.verdict,
              findings: Array.isArray(r.findings)
                ? r.findings.flatMap((f) =>
                    f && typeof f.title === 'string'
                      ? [{ title: f.title, detail: typeof f.detail === 'string' ? f.detail : '' }]
                      : [],
                  )
                : [],
              at: typeof r.at === 'number' ? r.at : 0,
            },
          ]
        : [],
    ),
    corrections: typeof box.corrections === 'number' && box.corrections > 0 ? Math.floor(box.corrections) : 0,
    mark: typeof box.mark === 'string' && box.mark ? box.mark : undefined,
    stopped:
      stop && typeof stop === 'object' && typeof stop.why === 'string'
        ? { reason: asStopReason(stop.reason), why: stop.why, at: typeof stop.at === 'number' ? stop.at : 0 }
        : undefined,
  }
}

const isVerdict = (value: unknown): value is ReviewVerdict =>
  value === 'pass' || value === 'correct' || value === 'ask'

// A stop we can't read is still a stop: `session` claims the least about why.
function asStopReason(value: unknown): ReviewStopReason {
  return value === 'ask' ||
    value === 'repeat' ||
    value === 'no-progress' ||
    value === 'limit' ||
    value === 'uncommitted' ||
    value === 'landing'
    ? value
    : 'session'
}

function readSteps(raw: unknown): DeliveryStep[] {
  if (!Array.isArray(raw)) return []
  return (raw as Partial<DeliveryStep>[]).flatMap((s) =>
    s && typeof s.step === 'string' && typeof s.at === 'number' ? [{ step: s.step, at: s.at }] : [],
  )
}

// A saved terminal state comes back as itself; anything unrecognized reads as `done`, the
// one state that claims nothing beyond "it ended".
function asStatus(value: unknown): RunStatus {
  return value === 'running' || value === 'error' || value === 'interrupted' || value === 'stopped'
    ? value
    : 'done'
}

// A delivery whose state we can't read is still in flight as far as anyone knows, and the
// safe reading of that is `active`: a card held by a delivery nobody can end would be the
// worse mistake, and Discard is one click from the card page either way.
function asDeliveryStatus(value: unknown): DeliveryStatus {
  return value === 'finished' || value === 'failed' || value === 'cancelled' ? value : 'active'
}

function writeStore(store: Store): void {
  const kept = {
    runs: prune(store.runs),
    deliveries: pruneDeliveries(store.deliveries),
    marks: store.marks,
  }
  fs.mkdirSync(path.dirname(SESSIONS), { recursive: true })
  const tmp = `${SESSIONS}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(kept, null, 2) + '\n')
  // Rename rather than write in place, so a reader never catches half a file.
  fs.renameSync(tmp, SESSIONS)
}

// Bound the record: keep every live run and the newest KEEP_RUNS finished ones, and
// drop a finished one whose log is already gone — its record would be a dead pointer.
function prune(runs: RunRecord[]): RunRecord[] {
  const live = runs.filter((r) => r.status === 'running')
  const finished = runs
    .filter((r) => r.status !== 'running' && fs.existsSync(r.logPath))
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, KEEP_RUNS)
  return [...live, ...finished].sort((a, b) => a.startedAt - b.startedAt)
}

// An ACTIVE delivery is never trimmed, however many newer ones there are: this row is what
// holds its card, and losing it would quietly hand the card back mid-delivery.
function pruneDeliveries(deliveries: DeliveryRecord[]): DeliveryRecord[] {
  const active = deliveries.filter((d) => d.status === 'active')
  const ended = deliveries
    .filter((d) => d.status !== 'active')
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, KEEP_DELIVERIES)
  return [...active, ...ended].sort((a, b) => a.startedAt - b.startedAt)
}

/** Read the record, change it, write it back — with its lock held the whole way. Every
 *  writer goes through this, so two processes never lose each other's change. */
export function withStore<T>(fn: (store: Store) => T): T {
  return withLock(SESSIONS_LOCK, "writing this board's run list", () => {
    const store = readStore()
    const before = JSON.stringify(store)
    const out = fn(store)
    // Only write when something moved. Every read goes through here — a board UI polls it
    // a couple of times a second — and rewriting the same file that often would be a lot
    // of churn for nothing.
    if (JSON.stringify(store) !== before) writeStore(store)
    return out
  })
}

/** The runs half of the record, changed under the same lock. */
export function withRuns<T>(fn: (runs: RunRecord[]) => T): T {
  return withStore((store) => fn(store.runs))
}

/** Attach cards made by `akb board create` to the run whose agent called it. */
export function recordCreatedCards(sessionId: string, ids: readonly number[]): boolean {
  const valid = ids.filter((id) => Number.isInteger(id) && id > 0)
  if (!valid.length) return false
  return withRuns((runs) => {
    const run = runs.find((entry) => entry.sessionId === sessionId && entry.status === 'running')
    if (!run) return false
    run.createdCardIds = [...new Set([...(run.createdCardIds ?? []), ...valid])]
    return true
  })
}
