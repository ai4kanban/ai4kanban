// docs/kanban/.sessions.json — the live record every process on this board shares.
//
// It holds two lists. The SESSIONS are agent invocations: what is running, and what ran
// lately. The DELIVERIES are the jobs those sessions belong to — one Implement click each,
// and several sessions long. Both live in a file rather than in memory because the
// processes that need them are not one process: a session started from a terminal, one
// started from a button, and one the board started on its own all land in the same lists,
// and the rules that hold a card still hold across all three.
//
// Nothing is kept between commands: every read is a read of the file, and every write
// takes the record's own lock.
//
// That lock is NOT the board's writing lock. A session's bookkeeping calls board moves —
// putting a card's stage back, stamping a recurring card — and those take the board lock
// themselves, so holding it here would deadlock.

import fs from 'node:fs'
import path from 'node:path'

import { withLock } from '../lock'
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
  LandingStatus,
  ReviewStopReason,
  ReviewVerdict,
  RunRecord,
  RunStatus,
} from './types'

/** How many finished sessions the record keeps. The logs outlive them by the same count. */
const KEEP_RUNS = 30

// And how many ended deliveries. Far fewer are needed here than sessions: this row is only
// the live copy, and the permanent one is the file under docs/kanban/deliveries/, which is
// tracked in git and never pruned.
const KEEP_DELIVERIES = 30

/** Where a session's log is written, from its id alone. */
export const logPathOf = (sessionId: string): string => path.join(SESSIONS_DIR, `${sessionId}.log`)

// `auto-refine` was this action's name until refine became the loop and there was only one
// of them. A board's history outlives a version, so an old record still reads.
export const readAction = (action: unknown): AgentAction =>
  action === 'auto-refine' ? 'refine' : (action as AgentAction)

/** Both lists as the file holds them. */
export interface Store {
  runs: RunRecord[]
  deliveries: DeliveryRecord[]
}

/** Everything the record holds, newest last. Reads only — no lock, because a half-written
 *  file is never what a reader sees: every write is atomic (write, then rename). */
export function readStore(): Store {
  let data: unknown
  try {
    data = JSON.parse(fs.readFileSync(SESSIONS, 'utf8'))
  } catch {
    return { runs: [], deliveries: [] }
  }
  const box = data as { runs?: unknown; live?: unknown; finished?: unknown; deliveries?: unknown }
  // `live`/`finished` is the shape the board UI's own registry wrote before the record
  // became everyone's. Read so an upgrade mid-session keeps its history.
  const raw = Array.isArray(box?.runs)
    ? box.runs
    : [...(Array.isArray(box?.live) ? box.live : []), ...(Array.isArray(box?.finished) ? box.finished : [])]
  const runs: RunRecord[] = []
  for (const entry of raw as Partial<RunRecord>[]) {
    if (!entry || typeof entry.sessionId !== 'string' || !entry.sessionId) continue
    runs.push({
      sessionId: entry.sessionId,
      cardId: typeof entry.cardId === 'number' ? entry.cardId : null,
      action: readAction(entry.action),
      status: asStatus(entry.status),
      startedAt: typeof entry.startedAt === 'number' ? entry.startedAt : Date.now(),
      endedAt: typeof entry.endedAt === 'number' ? entry.endedAt : undefined,
      pid: typeof entry.pid === 'number' ? entry.pid : undefined,
      input: typeof entry.input === 'string' ? entry.input : undefined,
      ok: typeof entry.ok === 'boolean' ? entry.ok : undefined,
      code: entry.code ?? null,
      error: typeof entry.error === 'string' ? entry.error : undefined,
      // A session that never reported a cost shows none, rather than a zero it didn't earn.
      costUsd: typeof entry.costUsd === 'number' && entry.costUsd > 0 ? entry.costUsd : undefined,
      usage: asUsage(entry.usage),
      model: typeof entry.model === 'string' && entry.model ? entry.model : undefined,
      result: typeof entry.result === 'string' ? entry.result : undefined,
      note: typeof entry.note === 'string' && entry.note ? entry.note : undefined,
      // A session written down before the agent was recorded carries no name, so it gets no
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
      deliveryId: typeof entry.deliveryId === 'string' && entry.deliveryId ? entry.deliveryId : undefined,
    })
  }
  runs.sort((a, b) => a.startedAt - b.startedAt)
  return { runs, deliveries: readDeliveryRows(box?.deliveries) }
}

/** Every session the record holds, newest last. */
export const readRuns = (): RunRecord[] => readStore().runs

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
      steps: readSteps(entry.steps),
      base: typeof entry.base === 'string' && entry.base ? entry.base : undefined,
      review: readReview(entry.review),
      priorStatus: typeof entry.priorStatus === 'string' && entry.priorStatus ? entry.priorStatus : undefined,
      next: entry.next === 'review' || entry.next === 'correct' ? entry.next : undefined,
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
      // existed has none, and its sessions read the files — which is what they always did.
      rules: readRules(entry.rules),
    })
  }
  return rows.sort((a, b) => a.startedAt - b.startedAt)
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined

// The rules a delivery froze, keyed by the command that starts the flow. An empty object is
// kept and undefined is not: `{}` means this delivery froze rules and none were set, while
// nothing at all means a delivery from before rules existed, whose sessions read the files.
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
// worse mistake, and Cancel delivery is one click from the card page either way.
function asDeliveryStatus(value: unknown): DeliveryStatus {
  return value === 'finished' || value === 'failed' || value === 'cancelled' ? value : 'active'
}

function writeStore(store: Store): void {
  const kept = { runs: prune(store.runs), deliveries: pruneDeliveries(store.deliveries) }
  fs.mkdirSync(path.dirname(SESSIONS), { recursive: true })
  const tmp = `${SESSIONS}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(kept, null, 2) + '\n')
  // Rename rather than write in place, so a reader never catches half a file.
  fs.renameSync(tmp, SESSIONS)
}

// Bound the record: keep every live session and the newest KEEP_RUNS finished ones, and
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
  return withLock(SESSIONS_LOCK, "writing this board's session list", () => {
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

/** The sessions half of the record, changed under the same lock. */
export function withRuns<T>(fn: (runs: RunRecord[]) => T): T {
  return withStore((store) => fn(store.runs))
}
