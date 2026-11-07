
import { executionOf } from '../cloud/execution'
import fs from 'node:fs'
import path from 'node:path'

import { forgetFileMemos, memoByFiles } from '../file-memo'
import { pidAlive, withLock } from '../lock'
import { die, SESSIONS, SESSIONS_DIR, SESSIONS_LOCK } from '../paths'
import { insideRun } from './env'
import { asContext, asUsage } from './log'
import type {
  AgentAction,
  AnswerVerdict,
  ChatHandoff,
  DeliveryLanding,
  DeliveryRecord,
  DeliveryReview,
  DeliveryStatus,
  DeliveryStep,
  FrozenWorkflow,
  LandingReason,
  LandingStatus,
  LandingWait,
  ReviewStopReason,
  ReviewVerdict,
  RunReason,
  RunReasonKind,
  RunRecord,
  RunRefusal,
  RunRefusalKind,
  RunRetry,
  RunStatus,
} from './types'
import type { CardCreation } from '../view/types'

/** How many finished runs the record keeps. Match KEEP_LOGS: a run whose log is gone is
 *  dropped here too, so the smaller of the two is what the Run dialog actually shows. */
const KEEP_RUNS = 100

// And how many ended deliveries. Far fewer are needed here than runs: this row is only
// the live copy, and the permanent one is the file under docs/kanban/deliveries/, which is
// tracked in git and never pruned.
const KEEP_DELIVERIES = 30

/** Where a run's log is written, from its id alone. */
export const logPathOf = (sessionId: string): string => path.join(SESSIONS_DIR, `${sessionId}.log`)
export const eventsPathOf = (sessionId: string): string => path.join(SESSIONS_DIR, `${sessionId}.events.jsonl`)

/** A run's log as the record has it, or this folder's own copy of it when the record names
 *  another folder. The record and the logs sit in the same folder (#590), so a history
 *  carried by hand into a renamed project arrives holding the paths it had where it was —
 *  and `prune` drops a finished run whose log it cannot find. */
function logPathIn(held: unknown, sessionId: string): string {
  return typeof held === 'string' && held.startsWith(SESSIONS_DIR + path.sep) ? held : logPathOf(sessionId)
}

// Names the clarify session went by in older builds: the whole refine flow as one action,
// then `raise-questions`. A board's history outlives a version, so those records stay
// readable.
const WAS_CLARIFY = new Set(['auto-refine', 'refine', 'raise-questions'])

const RETIRED_ACTIONS = new Set([
  'channel',
  'polish',
  'write',
  'marketing-polish-loop',
  'marketing-verify',
  'marketing-fix',
  'setup',
  'create',
])

/** Whether this version still has the action a record was written with. */
export const knownAction = (action: unknown): boolean => !RETIRED_ACTIONS.has(String(action))

export const readAction = (action: unknown): AgentAction => {
  if (typeof action !== 'string') return action as AgentAction
  if (action === 'conflict') return 'implement'
  if (WAS_CLARIFY.has(action)) return 'clarify'
  // Renamed in #1391.
  if (action === 'describe-product') return 'describe-project'
  return action as AgentAction
}

/** Everything the file holds. */
export interface Store {
  runs: RunRecord[]
  deliveries: DeliveryRecord[]
  /** One board mark per card, by id: the card as the last run to close over it left it.
   *  A change is claimed once, by the first close that sees it — see `claimChanges` in
   *  agent/refine.ts, which is the only thing that reads or writes this. */
  marks: Record<string, string>
  /** The cards a refine has been tried on and that are still refinable (#1366), so the board
   *  refines each one on its own once. Absent until the scheduler's first pass writes it. */
  refined?: number[]
}

/** Everything the record holds, newest last. Reads only — no lock, because a half-written
 *  file is never what a reader sees: every write is atomic (write, then rename). Parsed again
 *  only when the file changed. */
export const readStore = memoByFiles(() => [SESSIONS], parseStore)

function parseStore(): Store {
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
    refined?: unknown
  }
  // `live`/`finished` is the shape the board UI's own registry wrote before the record
  // became everyone's. Read so an upgrade mid-run keeps its history.
  const raw = Array.isArray(box?.runs)
    ? box.runs
    : [...(Array.isArray(box?.live) ? box.live : []), ...(Array.isArray(box?.finished) ? box.finished : [])]
  const runs: RunRecord[] = []
  for (const entry of raw as Partial<RunRecord>[]) {
    if (!entry || typeof entry.sessionId !== 'string' || !entry.sessionId) continue
    if (!knownAction(entry.action)) continue
    runs.push({
      sessionId: entry.sessionId,
      cardId: typeof entry.cardId === 'number' ? entry.cardId : null,
      createdCardIds: Array.isArray(entry.createdCardIds)
        ? [...new Set(entry.createdCardIds.filter((id): id is number => Number.isInteger(id) && id > 0))]
        : undefined,
      discard: entry.discard === true || undefined,
      discardedCards: Array.isArray(entry.discardedCards) ? entry.discardedCards.filter((c) => Number.isInteger(c?.id) && typeof c.path === 'string').map((c) => ({ id: c.id, path: c.path, ...(c.pending ? { pending: true } : {}) })) : undefined,
      action: readAction(entry.action),
      status: asStatus(entry.status),
      startedAt: typeof entry.startedAt === 'number' ? entry.startedAt : Date.now(),
      endedAt: typeof entry.endedAt === 'number' ? entry.endedAt : undefined,
      pid: typeof entry.pid === 'number' ? entry.pid : undefined,
      agentPid: Number.isInteger(entry.agentPid) && entry.agentPid! > 0 ? entry.agentPid : undefined,
      agentStartedAt: typeof entry.agentStartedAt === 'number' ? entry.agentStartedAt : undefined,
      input: typeof entry.input === 'string' ? entry.input : undefined,
      ok: typeof entry.ok === 'boolean' ? entry.ok : undefined,
      code: entry.code ?? null,
      error: typeof entry.error === 'string' ? entry.error : undefined,
      blocker: readBlocker(entry.blocker),
      // A run that never reported a cost shows none, rather than a zero it didn't earn.
      costUsd: typeof entry.costUsd === 'number' && entry.costUsd > 0 ? entry.costUsd : undefined,
      sessionCostUsd: typeof entry.sessionCostUsd === 'number' && entry.sessionCostUsd > 0 ? entry.sessionCostUsd : undefined,
      sessionCostFrom: typeof entry.sessionCostFrom === 'number' && entry.sessionCostFrom > 0 ? entry.sessionCostFrom : undefined,
      usage: asUsage(entry.usage),
      // How full the window was at the run's last request (#675). Whitelisted like
      // everything else here: a reader that skipped it would drop it on the next write, and
      // a live run writes this over and over while it goes.
      context: asContext(entry.context),
      model: typeof entry.model === 'string' && entry.model ? entry.model : undefined,
      result: typeof entry.result === 'string' ? entry.result : undefined,
      note: typeof entry.note === 'string' && entry.note ? entry.note : undefined,
      errorWhy: readReasons(entry.errorWhy),
      noteWhy: readReasons(entry.noteWhy),
      // A run written down before the agent was recorded carries no name, so it gets no
      // resume: every agent resumes differently, and the one thing worse than a missing
      // offer is a command for the wrong agent.
      harness: typeof entry.harness === 'string' ? entry.harness : '',
      // The row it ran as (#518). Absent on a run written before runtimes, which then
      // resumes on its agent's own row inside the harness it went on.
      runtime: typeof entry.runtime === 'string' && entry.runtime ? entry.runtime : undefined,
      agent: typeof entry.agent === 'string' && entry.agent ? entry.agent : undefined,
      // What it ran as and where (#628). Whitelisted here like every other field: a reader
      // that did not name them would drop them on the next write.
      version: typeof entry.version === 'string' && entry.version ? entry.version : undefined,
      cwd: typeof entry.cwd === 'string' && entry.cwd ? entry.cwd : undefined,
      argv: Array.isArray(entry.argv) && entry.argv.every((a: unknown) => typeof a === 'string') ? entry.argv : undefined,
      resumeId: typeof entry.resumeId === 'string' ? entry.resumeId : undefined,
      logPath: logPathIn(entry.logPath, entry.sessionId),
      resumedFrom: typeof entry.resumedFrom === 'string' ? entry.resumedFrom : undefined,
      continues: typeof entry.continues?.resumeId === 'string' && entry.continues.resumeId
        ? { resumeId: entry.continues.resumeId, ...(entry.continues.fork === true ? { fork: true } : {}) }
        : undefined,
      formatRepair: entry.formatRepair && typeof entry.formatRepair === 'object'
        && Number.isInteger(entry.formatRepair.attempt) && entry.formatRepair.attempt >= 0
        && typeof entry.formatRepair.errors === 'string'
        && [entry.formatRepair.cardIds, entry.formatRepair.changedIds, entry.formatRepair.existingIds].every((ids) => Array.isArray(ids) && ids.every(Number.isInteger))
        ? entry.formatRepair : undefined,
      retry: readRetry(entry.retry),
      priorStatus: typeof entry.priorStatus === 'string' ? entry.priorStatus : undefined,
      // The pictures the create sheet handed this run (#517), as paths in its own folder.
      pictures: readPictures(entry.pictures),
      stopping: entry.stopping === true ? true : undefined,
      unspawned: entry.unspawned === true ? true : undefined,
      workflow: typeof entry.workflow === 'string' && entry.workflow ? entry.workflow : undefined,
      specAgent: typeof entry.specAgent === 'string' && entry.specAgent ? entry.specAgent : undefined,
      triage: typeof entry.triage === 'string' ? entry.triage : undefined,
      refineRound:
        typeof entry.refineRound === 'number' && Number.isInteger(entry.refineRound) && entry.refineRound >= 0
          ? entry.refineRound
          : undefined,
      flowId: typeof entry.flowId === 'string' && entry.flowId ? entry.flowId : undefined,
      deliveryId: typeof entry.deliveryId === 'string' && entry.deliveryId ? entry.deliveryId : undefined,
      parentId: typeof entry.parentId === 'string' && entry.parentId ? entry.parentId : undefined,
      cards: Array.isArray(entry.cards) && entry.cards.every(Number.isInteger) ? entry.cards : undefined,
    })
  }
  runs.sort((a, b) => a.startedAt - b.startedAt)
  const refined = readRefined(box?.refined)
  return { runs, deliveries: readDeliveryRows(box?.deliveries), marks: readMarks(box?.marks), ...(refined ? { refined } : {}) }
}

const strings = (raw: unknown): string[] | undefined =>
  Array.isArray(raw) && raw.every((x) => typeof x === 'string') ? raw : undefined

const stringRecord = (raw: unknown): Record<string, string> | undefined =>
  raw && typeof raw === 'object' && !Array.isArray(raw) && Object.values(raw).every((v) => typeof v === 'string')
    ? raw as Record<string, string>
    : undefined

// A run's `error` and `note` by kind (#1241). A malformed part is dropped; the English stands.
function readReasons(raw: unknown): RunReason[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const reasons = raw.flatMap((entry): RunReason[] => {
    if (!entry || typeof entry !== 'object') return []
    const r = entry as Record<string, unknown>
    const refusals = Array.isArray(r.refusals)
      ? r.refusals.flatMap((x): RunRefusal[] => {
          const f = x as Partial<RunRefusal> | null
          if (!f || typeof f.error !== 'string') return []
          const args = stringRecord(f.args)
          return [{ error: f.error, ...(typeof f.reason === 'string' ? { reason: f.reason as RunRefusalKind } : {}), ...(args ? { args } : {}) }]
        })
      : undefined
    const out: RunReason = {
      ...(typeof r.kind === 'string' ? { kind: r.kind as RunReasonKind } : {}),
      ...(stringRecord(r.args) ? { args: stringRecord(r.args) } : {}),
      ...(strings(r.lines) ? { lines: strings(r.lines) } : {}),
      ...(refusals ? { refusals } : {}),
      ...(typeof r.text === 'string' ? { text: r.text } : {}),
    }
    return out.kind || out.text ? [out] : []
  })
  return reasons.length ? reasons : undefined
}

// The retry a run is part of (#525). All four numbers or nothing: a half-written one would
// let a chain count attempts against a window it never had, which is a card held for
// longer than the policy allows.
function readRetry(raw: unknown): RunRetry | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Partial<RunRetry>
  const whole =
    Number.isInteger(r.attempt) && (r.attempt as number) > 0 &&
    Number.isInteger(r.of) && (r.of as number) > 0 &&
    typeof r.reason === 'string' && !!r.reason &&
    typeof r.at === 'number' && typeof r.since === 'number'
  return whole
    ? { attempt: r.attempt as number, of: r.of as number, reason: r.reason as string, at: r.at as number, since: r.since as number }
    : undefined
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

// Absent is not empty (#1366): a record with no list is one the scheduler has yet to seed.
function readRefined(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw)) return undefined
  return [...new Set(raw.filter((id): id is number => Number.isInteger(id) && id > 0))]
}

/** A refine is starting on this card (#1366), so the board will not start one itself. A
 *  list not yet seeded is left alone: the seeding pass takes every refinable card anyway. */
export function noteRefineTried(store: Store, cardId: number): void {
  if (store.refined && !store.refined.includes(cardId)) store.refined.push(cardId)
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

export function cardsBeingCreated(runs: RunRecord[] = readRuns()): Map<number, CardCreation> {
  const newest = new Map<number, RunRecord>()
  for (const run of runs) {
    for (const id of run.createdCardIds ?? []) {
      if (run.cardId === id) continue
      const best = newest.get(id)
      if (!best || run.startedAt >= best.startedAt) newest.set(id, run)
    }
  }
  const out = new Map<number, CardCreation>()
  for (const [id, run] of newest) {
    if (runIsLive(run)) out.set(id, { state: 'creating', runId: run.sessionId })
    else if (run.status !== 'done') out.set(id, { state: 'unfinished', runId: run.sessionId })
  }
  return out
}

/** How far one card's creation got, or undefined once it is complete. */
export const creationOf = (runs: RunRecord[], cardId: number): CardCreation | undefined =>
  cardsBeingCreated(runs).get(cardId)

export const cardCreation = (cardId: number, strict = false): CardCreation | undefined => {
  const runs = readRuns()
  if (!strict && runs.some((r) => r.discardedCards?.some((c) => c.id === cardId))) die(`#${cardId} was discarded. Do not restore or recreate it.`, { kind: 'card-being-created' })
  const state = creationOf(runs, cardId)
  if (strict) return state
  return state && state.runId === insideRun() ? undefined : state
}

function readDeliveryRows(raw: unknown): DeliveryRecord[] {
  if (!Array.isArray(raw)) return []
  const rows: DeliveryRecord[] = []
  for (const entry of raw) {
    const row = readDeliveryRow(entry)
    if (row) rows.push(row)
  }
  return rows.sort((a, b) => a.startedAt - b.startedAt)
}

export function readDeliveryRow(raw: unknown): DeliveryRecord | null {
  const entry = raw as Partial<DeliveryRecord>
  if (!entry || typeof entry.deliveryId !== 'string' || !entry.deliveryId) return null
  return {
    deliveryId: entry.deliveryId,
    cardId: Number.isInteger(entry.cardId) ? (entry.cardId as number) : null,
    title: typeof entry.title === 'string' ? entry.title : '',
    status: asDeliveryStatus(entry.status),
    startedAt: typeof entry.startedAt === 'number' ? entry.startedAt : Date.now(),
    endedAt: typeof entry.endedAt === 'number' ? entry.endedAt : undefined,
    sessions: Array.isArray(entry.sessions) ? entry.sessions.filter((s) => typeof s === 'string') : [],
    cloudExecution: executionOf(entry.cloudExecution ?? null),
    approved: typeof entry.approved === 'string' ? entry.approved : '',
    // The plan a card-less build was started from (#481), where it was one.
    plan: text(entry.plan),
    initialQuestions:
      typeof entry.initialQuestions === 'number' && entry.initialQuestions >= 0
        ? Math.floor(entry.initialQuestions)
        : undefined,
    steps: readSteps(entry.steps),
    completions: Array.isArray(entry.completions) ? entry.completions.filter((c) =>
      c && typeof c.sessionId === 'string' && Number.isInteger(c.step) && typeof c.at === 'number') : undefined,
    base: typeof entry.base === 'string' && entry.base ? entry.base : undefined,
    review: readReview(entry.review),
    // What each round of answers concluded (#637). A delivery from before this has none,
    // and a round nothing judged is a round the board will not guess at.
    answers: readAnswers(entry.answers),
    priorStatus: typeof entry.priorStatus === 'string' && entry.priorStatus ? entry.priorStatus : undefined,
    commitMode:
      entry.commitMode === 'auto' || entry.commitMode === 'manual' || entry.commitMode === 'files'
        ? entry.commitMode
        : undefined,
    touched: readTouched(entry.touched),
    planned: Array.isArray(entry.planned) ? entry.planned.filter((t): t is string => typeof t === 'string') : undefined,
    manualWhy: text(entry.manualWhy),
    targetBranch: text(entry.targetBranch),
    worktree: text(entry.worktree),
    branch: text(entry.branch),
    reviewed: readReviewed(entry.reviewed),
    landing: readLanding(entry.landing),
    // The flow rules this delivery froze (#306). A delivery written down before they
    // existed has none, and its runs read the files — which is what they always did.
    rules: readRules(entry.rules),
    // The workflow this delivery froze (#715). A delivery written down before workflows
    // existed has none, and its runs read the board — which is what they always did.
    workflow: readWorkflow(entry.workflow),
    scheduled:
      entry.scheduled && typeof entry.scheduled.workflow === 'string' && typeof entry.scheduled.agent === 'string'
        ? { workflow: entry.scheduled.workflow, agent: entry.scheduled.agent }
        : undefined,
  }
}

// The workflow a delivery froze, whole. Dropped rather than half-read: a frozen workflow
// with no id names nothing, and a run given half of one would resolve the other half off the
// board — which is the one thing freezing it exists to prevent.
function readWorkflow(raw: unknown): FrozenWorkflow | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const box = raw as Record<string, unknown>
  const id = text(box.id)
  if (!id) return undefined
  const rows = (value: unknown): { agent: string; extra: string }[] =>
    (Array.isArray(value) ? value : []).flatMap((one) => {
      if (!one || typeof one !== 'object' || Array.isArray(one)) return []
      const row = one as Record<string, unknown>
      const agent = text(row.agent)
      return agent ? [{ agent, extra: typeof row.extra === 'string' ? row.extra : '' }] : []
    })
  // A delivery frozen before #2152 kept `stages`: its plan hooks are its previews, and its
  // execute lead what lands it. One frozen under #2152 kept its previews in rounds.
  const stages = box.stages && typeof box.stages === 'object' ? (box.stages as Record<string, Record<string, unknown> | undefined>) : {}
  const lead = text(stages.execute?.lead)
  const previews = Array.isArray(box.previews) ? rows(box.previews.flat()) : stages.plan ? rows(stages.plan.helpers) : []
  const land = Array.isArray(box.land) ? rows(box.land) : lead ? [{ agent: lead, extra: '' }] : []
  return {
    id,
    name: typeof box.name === 'string' ? box.name : '',
    ...(box.needsArtifact === true ? { needsArtifact: true } : {}),
    previews,
    land,
  }
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined

function readTouched(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  return Object.fromEntries(Object.entries(raw).filter((e): e is [string, string] => typeof e[1] === 'string'))
}

// The pictures a run was handed (#517). Their folder can go before the record does — the
// prune takes it with the log — so a name that no longer answers is simply not read back.
function readPictures(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const files = raw.filter((p): p is string => typeof p === 'string' && p.length > 0)
  return files.length ? files : undefined
}

function readBlocker(raw: unknown): RunRecord['blocker'] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const box = raw as Record<string, unknown>
  const step = text(box.step)
  const cause = text(box.cause)
  const unblock = text(box.unblock)
  return step && cause && unblock ? { step, cause, unblock } : undefined
}

function readRules(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const rules: Record<string, string> = {}
  for (const [command, rule] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof rule === 'string' && rule) rules[command] = rule
  }
  return rules
}

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
    rebasedFrom: text(box.rebasedFrom),
    originalBase: text(box.originalBase),
    rebaseKind:
      box.rebaseKind === 'disjoint' || box.rebaseKind === 'overlap' || box.rebaseKind === 'conflict'
        ? box.rebaseKind
        : undefined,
    commit: text(box.commit),
    onto: text(box.onto),
    overlap: Array.isArray(box.overlap) ? box.overlap.filter((n) => Number.isInteger(n)) : undefined,
    wait: readLandingWait(box.wait),
    reason: readLandingReason(box.reason),
    conflictFiles: Array.isArray(box.conflictFiles)
      ? box.conflictFiles.filter((f): f is string => typeof f === 'string')
      : undefined,
    conflictFails: num(box.conflictFails),
    conflictAt: num(box.conflictAt),
    fitAt: num(box.fitAt),
    retryAt: num(box.retryAt),
    checks: Array.isArray(box.checks)
      ? box.checks.flatMap((c) =>
          c && typeof c.name === 'string' ? [{ name: c.name, ok: c.ok === true, at: num(c.at) ?? 0 }] : [],
        )
      : undefined,
    at: num(box.at) ?? 0,
  }
}

// The user's own files a landing will not write over (#958). Both halves have to read, or
// the wait is just its sentence: a kind with no files says nothing a screen can list.
function readLandingWait(raw: unknown): DeliveryLanding['wait'] {
  if (!raw || typeof raw !== 'object') return undefined
  const box = raw as Partial<LandingWait>
  if (box.kind !== 'overwrite' && box.kind !== 'untracked') return undefined
  const files = Array.isArray(box.files) ? box.files.filter((f): f is string => typeof f === 'string') : []
  return files.length ? { kind: box.kind, files } : undefined
}

const LANDING_REASONS: ReadonlySet<string> = new Set<LandingReason['kind']>([
  'queued',
  'worktree-gone',
  'no-base',
  'target-gone',
  'worktree-dirty',
  'interrupted',
])

// Which fixed sentence a landing's `why` is (#1377). A kind this copy does not know is
// dropped, and the screen falls back to the sentence.
function readLandingReason(raw: unknown): DeliveryLanding['reason'] {
  if (!raw || typeof raw !== 'object') return undefined
  const box = raw as Partial<LandingReason>
  if (!LANDING_REASONS.has(box.kind as string)) return undefined
  const files = Array.isArray(box.files) ? box.files.filter((f): f is string => typeof f === 'string') : []
  return {
    kind: box.kind as LandingReason['kind'],
    ...(text(box.behind) ? { behind: text(box.behind) } : {}),
    ...(files.length ? { files } : {}),
  }
}

const asLandingStatus = (value: unknown): LandingStatus =>
  value === 'landing' || value === 'landed' || value === 'conflict' ? value : 'waiting'

// What each round of answers concluded about this delivery's requirements (#637). A row
// missing either half is dropped rather than read as `unchanged`: a conclusion nobody can
// read is a round nobody judged, and the board holds for one rather than guessing.
function readAnswers(raw: unknown): AnswerVerdict[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const answers = raw.flatMap((entry: Partial<AnswerVerdict>) => {
    if (!entry || (entry.outcome !== 'changed' && entry.outcome !== 'unchanged')) return []
    const why = text(entry.why)
    if (!why) return []
    return [
      {
        outcome: entry.outcome,
        why,
        at: typeof entry.at === 'number' ? entry.at : 0,
        actedAt: typeof entry.actedAt === 'number' ? entry.actedAt : undefined,
      },
    ]
  })
  return answers.length ? answers : undefined
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
    stopped:
      stop && typeof stop === 'object' && typeof stop.why === 'string'
        ? {
            reason: asStopReason(stop.reason),
            why: stop.why,
            at: typeof stop.at === 'number' ? stop.at : 0,
            ...(Array.isArray(stop.paths) ? { paths: stop.paths.filter((p): p is string => typeof p === 'string') } : {}),
          }
        : undefined,
  }
}

const isVerdict = (value: unknown): value is ReviewVerdict =>
  value === 'pass' || value === 'ask'

// A stop we can't read is still a stop: `session` claims the least about why.
function asStopReason(value: unknown): ReviewStopReason {
  return value === 'ask' ||
    value === 'repeat' ||
    value === 'no-progress' ||
    value === 'limit' ||
    value === 'uncommitted' ||
    value === 'landing' ||
    value === 'capability' ||
    value === 'outside' ||
    value === 'output'
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

// Persist the run registry atomically.
function writeStore(store: Store): void {
  const deliveries = pruneDeliveries(store.deliveries)
  const kept = {
    runs: prune(store.runs, deliveries),
    deliveries,
    marks: store.marks,
    ...(store.refined ? { refined: store.refined } : {}),
  }
  fs.mkdirSync(path.dirname(SESSIONS), { recursive: true })
  const tmp = `${SESSIONS}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(kept, null, 2) + '\n')
  // Rename rather than write in place, so a reader never catches half a file.
  fs.renameSync(tmp, SESSIONS)
  forgetFileMemos()
}

function prune(runs: RunRecord[], deliveries: DeliveryRecord[]): RunRecord[] {
  const held = new Set(deliveries.filter(holdsCheckout).map((d) => d.deliveryId))
  const live = runs.filter((r) => r.status === 'running')
  const finished = runs
    .filter((r) => r.status !== 'running' && (fs.existsSync(r.logPath) || (r.deliveryId && held.has(r.deliveryId))))
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, KEEP_RUNS)
  const spared = runs.filter(
    (r) => r.status !== 'running' && !finished.includes(r) && (!!r.discardedCards?.length || (r.deliveryId && held.has(r.deliveryId))),
  )
  return [...live, ...finished, ...spared].sort((a, b) => a.startedAt - b.startedAt)
}

function pruneDeliveries(deliveries: DeliveryRecord[]): DeliveryRecord[] {
  const kept = deliveries.filter((d) => d.status === 'active' || holdsCheckout(d))
  const ended = deliveries
    .filter((d) => !kept.includes(d))
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, KEEP_DELIVERIES)
  return [...kept, ...ended].sort((a, b) => a.startedAt - b.startedAt)
}

// Read off the row alone — no git, no board — because this runs on every write of a record
// the board's screens poll twice a second.
const holdsCheckout = (d: DeliveryRecord): boolean => d.status === 'active' || !!d.worktree

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

/** Attach cards made by `akb raw create` to the run whose agent called it. */
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

/** A card's creating session (#1222) as a file holds it, or nothing when it names none. */
export function handoffOf(value: unknown): ChatHandoff | undefined {
  const h = value as Partial<ChatHandoff> | undefined
  if (!h || typeof h.harness !== 'string' || !h.harness) return undefined
  const resumeId = typeof h.resumeId === 'string' && h.resumeId ? h.resumeId : undefined
  if (!resumeId) return undefined
  return {
    harness: h.harness,
    runtime: typeof h.runtime === 'string' && h.runtime ? h.runtime : undefined,
    resumeId,
    cwd: typeof h.cwd === 'string' && h.cwd ? h.cwd : undefined,
  }
}
