// What is running, and the rules that decide what may start.
//
// The record itself is a file — docs/kanban/.sessions.json — and agent/store.ts owns it.
// This is everything around it: which run may start on which card, the bookkeeping either
// side of one, and the delivery a run belongs to.
//
// Alongside the record sits docs/kanban/.sessions/: one log per run, and, while one is
// starting, the plan it was started with. Both are the run's own; the record points at
// them.

import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { locate } from '../cards'
import { parseFrontmatter } from '../frontmatter'
import { recordCardRun, setCardStatusOn } from '../board'
// pidAlive lives with the lock, which needs the same question answered about whoever holds it.
import { pidAlive } from '../lock'
import { INDEX_LOCK, SESSIONS_DIR } from '../paths'
import {
  activeDelivery,
  endDelivery,
  findDelivery,
  joinActive,
  joinDelivery,
  listDeliveries,
  namedDelivery,
  settleDelivery,
  syncAudit,
} from './deliveries'
import { DELIVERY_FLOWS } from './flows'
import { deliveryCwd, prepareDelivery, undoPrepared, type DeliveryStart } from './commit-mode'
import { repairLanding } from './landing'
import { branchExists, pruneWorktreeMetadata, removeWorktree, worktreeExists } from './worktree'
import { durationLine, KEEP_LOGS, readLogTail, splitLog } from './log'
import { adoptsSessionId, planResume, planRun, resumableHarness, type RunPlan } from './resolve'
import { logPathOf, readRuns, readStore, withRuns, withStore } from './store'
import { REFINE_ACTIONS } from './types'
import type {
  AgentAction,
  AgentRequest,
  DeliveryRecord,
  RunRecord,
  RunStatus,
  RunView,
  SpecAsk,
} from './types'

export { logPathOf, readAction, readRuns, withRuns } from './store'

// A run that has been written down but whose watcher hasn't reported its pid yet. Anything
// older than this with no pid was never really started — the command died between writing
// the record and spawning — so it stops counting as live.
const PENDING_MS = 30_000

// create / propose / archive / reject all rewrite the board's shared files (next-id, the
// README index, metrics.csv). Two at once corrupt each other even on different cards, so
// these wait for one another. Propose allocates several ids in one run, so it belongs here
// too, and so does a recurring run: its close bumps metrics.csv and rewrites the README
// index, the very files this lock exists for. A plan-release run belongs here for the same
// reason propose does — it allocates ids and rewrites the index as it moves cards in. So
// does a setup run: its last step writes the board's first cards.
const INDEX_ACTIONS = new Set<AgentAction>(['create', 'propose', 'archive', 'reject', 'run', 'plan-release', 'setup'])

// Actions that may run only one at a time across the whole board. A create has no card
// yet, so the per-card rule can't catch a duplicate. A plan-release run is one of them
// too: it has no card id either, and two at once — on one release or on two — would read
// the same board and write the same missing cards twice. A setup run is the third, and the
// starkest: two of them would work down the same checklist side by side.
const SINGLETON_ACTIONS = new Set<AgentAction>(['create', 'propose', 'plan-release', 'setup'])

// Past-tense verb for the "already running" refusal, e.g. "#5 is already being
// implemented".
const VERB: Record<AgentAction, string> = {
  implement: 'implemented',
  run: 'run',
  reject: 'rejected',
  archive: 'archived',
  edit: 'edited',
  create: 'created',
  propose: 'proposed',
  'raise-questions': 'audited',
  resolve: 'resolved',
  writing: 'rewritten',
  'plan-release': 'planned',
  setup: 'set up',
  spec: 'specified',
  changelog: 'written up',
  review: 'reviewed',
  correct: 'corrected',
  conflict: 'unblocked',
}

// The refusal a one-at-a-time action gets when one of its own is already going, where the
// "a task is already being …" sentence doesn't fit.
const SINGLETON_BUSY: Partial<Record<AgentAction, string>> = {
  'plan-release': 'a release is already being planned',
  setup: 'this board is already being set up',
}

// A run's action maps to the saved stage it puts the card in while it goes. Only a
// delivery's own runs set one — the rest either refine the card or touch no resting
// card. Review is the delivery still working, so the card reads the same through both.
const RUN_STATUS: Partial<Record<AgentAction, string>> = {
  implement: 'implementing',
  review: 'implementing',
  correct: 'implementing',
  conflict: 'implementing',
}


/** Everything a watcher needs to start the run it was handed. Written beside the log so
 *  the command that starts a run and the process that runs it are not the same process. */
export interface RunSpec {
  sessionId: string
  plan: RunPlan
  prompt: string
  /** What the board owes this run's log before the agent's own output — a spec agent's
   *  setting that had to fall back, and nothing else today. The watcher writes them out as
   *  it opens the log, so the reason is above the work it changed. */
  notes?: string[]
}

export interface StartResult {
  ok: boolean
  sessionId?: string
  error?: string
}

// What a run leaves on disk, and none of it belongs in git: the record is this machine's
// answer to "what is running", and the logs are one agent's output on one afternoon. The
// two locks are transient — they exist for the milliseconds a write takes, and only ever
// reach git if a process is killed mid-write.
export const RUN_IGNORE_LINES = [
  { line: '.sessions.json', comment: '# What is running on this machine, and what ran lately.' },
  { line: '.sessions/', comment: "# One log per run — the agent's own output." },
  { line: '.sessions.lock/', comment: '# The lock that record is written under.' },
  { line: '.index.lock/', comment: '# Held by the one run at a time that may rewrite the board index.' },
]

// ---- the run's own files ---------------------------------------------------

const specPathOf = (sessionId: string): string => path.join(SESSIONS_DIR, `${sessionId}.plan.json`)
// The spec agents a run asked for while it went, waiting for its watcher to start them.
const asksPathOf = (sessionId: string): string => path.join(SESSIONS_DIR, `${sessionId}.asks.json`)


// ---- what is still alive ---------------------------------------------------

// A run whose watcher is gone was INTERRUPTED, never finished. Nobody witnessed its end, so
// there is no exit code, no final message, and no reason to believe the work is complete.
// It reads as unfinished and offers Resume.
//
// Unless a stop had already been asked for: then the process ending is the stop landing,
// and the run is `stopped`.
function reap(runs: RunRecord[], reaped: RunRecord[] = [], restore: RunRecord[] = []): boolean {
  let changed = false
  const now = Date.now()
  for (const r of runs) {
    if (r.status !== 'running') continue
    // No pid yet: the command that started it hasn't spawned the watcher. Give it a moment
    // before calling it gone — after that, nothing is ever going to report on it.
    if (!r.pid) {
      if (now - r.startedAt < PENDING_MS) continue
    } else if (pidAlive(r.pid)) {
      continue
    }
    r.status = r.stopping ? 'stopped' : 'interrupted'
    r.code = null // we saw no exit
    // We only know it ended by the time we noticed, so this duration is an upper bound.
    r.endedAt = now
    stampDuration(r, r.endedAt)
    // The card's stage is put back OUTSIDE this lock, like the delivery below it: writing
    // the board is one of the board's own operations now, and holding the record's lock
    // across it would be holding one lock while waiting on another (#312).
    restore.push({ ...r })
    // A run cut off mid-delivery is settled outside this lock: a build that was cut
    // off leaves the delivery ACTIVE and unfinished, and a review cut off stops and asks
    // (#302). Legacy correction runs follow the same path.
    if (r.deliveryId) reaped.push({ ...r })
    dropSpec(r.sessionId)
    changed = true
  }
  return changed
}

// The duration line, for the paths that don't own the log's write stream. Best-effort: a
// missing log just means the duration rests in the record alone.
function stampDuration(run: RunRecord, endedAt: number): void {
  try {
    fs.appendFileSync(run.logPath, durationLine(endedAt - run.startedAt))
  } catch {
    // no log file (never spawned, or pruned) — nothing to stamp
  }
}

// ---- the board's own bookkeeping around a run ------------------------------

// The board owns every frontmatter field, so a run never hand-writes one — it calls the
// board's own operation (lib/board). Best-effort and silent: if the card is gone (archived
// by the very run that just ended) or the board refuses, the run is over either way and its
// answer is elsewhere.
export async function setCardStatus(cardId: number, status: string): Promise<void> {
  try {
    await setCardStatusOn(cardId, status)
  } catch {
    // the board would not take the write — leave the stage as it is
  }
}

/** The card's stage and whether it has open questions, or null when there is no such card.
 *  Read straight off the file: this is the same board every move writes. */
function cardNow(cardId: number): { status: string; questions: number; title: string } | null {
  try {
    const found = locate(cardId)
    if (!found) return null
    const { meta } = parseFrontmatter(fs.readFileSync(found.target, 'utf8'))
    if (!meta) return null
    return { status: meta.status || 'todo', questions: meta.questions.length, title: meta.title }
  } catch {
    return null
  }
}

/** The card write a claim still owes, once the run record has remembered what was there. */
export interface CardClaim {
  cardId: number
  status: string
}

/** Remember the stage the card had — so the end of the run puts back what was there rather
 *  than always dropping it to `todo` — and say how to mark it as being worked on.
 *
 *  Only the record is changed here: this runs under the run record's lock (`patch`), and
 *  the caller awaits `setCardStatus` with that lock released. */
export function claimCard(run: RunRecord): CardClaim | undefined {
  const wanted = run.cardId !== null ? RUN_STATUS[run.action] : undefined
  if (run.cardId === null || !wanted) return undefined
  // Inside a delivery the stage to put back is the delivery's, taken before its first
  // run touched the card. Reading it here would give every run after the build
  // `implementing` — the stage the delivery itself put there — and the card would rest on
  // it forever.
  const delivery = run.deliveryId ? activeDelivery(run.cardId) : undefined
  run.priorStatus =
    (delivery && delivery.deliveryId === run.deliveryId ? delivery.priorStatus : undefined) ??
    cardNow(run.cardId)?.status ??
    'todo'
  return { cardId: run.cardId, status: wanted }
}

// When a run ends and its card still exists, restore the stage it had before — so a `ready`
// card is `ready` again, not knocked back to `todo`. Questions always win: if the run left
// the card with open questions, drop it to `todo` whatever the prior stage. If the run
// finished the task (archive/reject removed the card) this is a harmless no-op.
async function restoreCardStatus(run: RunRecord): Promise<void> {
  if (run.cardId === null || !RUN_STATUS[run.action]) return
  // A delivery still in flight is still building this card — its run ended, not the
  // job — so the stage stays where the delivery put it until the delivery itself ends.
  if (run.deliveryId && activeDelivery(run.cardId)?.deliveryId === run.deliveryId) return
  const card = cardNow(run.cardId)
  if (!card) return // archived or rejected — nothing to restore
  await setCardStatus(run.cardId, card.questions > 0 ? 'todo' : run.priorStatus ?? 'todo')
}

// The card's stage when nothing is working on it any more, for the one path that has no
// run to read a prior stage from: a delivery cancelled between its runs. Questions
// or not, a card nobody is building rests at `todo`.
async function releaseCard(cardId: number): Promise<void> {
  if (cardNow(cardId)?.status === 'implementing') await setCardStatus(cardId, 'todo')
}

// Recording a recurring run is the board's own bookkeeping, not part of the job the card
// describes — so the run does it at its close rather than asking the agent to stamp itself
// mid-flow. The stamp is what the cadence counts from, and leaving it to the agent meant a
// run that died on the last step left the card frozen.
//
// Only a run that PASSED is recorded. A failed, stopped or interrupted run never reached
// the end of the `## Process`, so `last_run` stays where it was and the card is still due.
async function recordRecurringRun(run: RunRecord): Promise<void> {
  if (run.action !== 'run' || run.cardId === null || run.status !== 'done') return
  try {
    await recordCardRun(run.cardId)
  } catch {
    // the card is gone, or the board would not take the write — the run is over either way
  }
}

// ---- reading ---------------------------------------------------------------

// The id a run's conversation is resumed by — the AGENT's id for it, which is a different
// thing from `sessionId`, our key for the run. They coincide in one case, and that case is
// the common one: a run started fresh under an agent that takes the id we generate IS its
// conversation, so the id needs no recording.
//
// The two cases where the id came from somewhere else, and only the field can answer:
//   • the agent minted its own mid-run and reported it (Codex's thread id) — until that
//     arrives there is genuinely no id to continue by;
//   • THIS run is a later turn of an earlier conversation. It carries that conversation's
//     id, not our new key.
function resumeIdOf(r: RunRecord): string | undefined {
  if (adoptsSessionId(r.harness) && !r.resumedFrom) return r.sessionId
  return r.resumeId
}

// A run that ended before finishing, so there is something left to continue: it failed, it
// was cut off, or the user stopped it. A stop ends the run, not the conversation — changing
// their mind is one click, and the alternative is redoing the work from the top. The one
// test behind both the offer and the refusal.
const canPickUp = (r: RunRecord): boolean =>
  r.status === 'error' || r.status === 'interrupted' || r.status === 'stopped'

function toView(r: RunRecord, resumable: string | null): RunView {
  return {
    ...r,
    durationMs: r.status !== 'running' && r.endedAt ? r.endedAt - r.startedAt : undefined,
    // The Resume offer, and everything it needs to be honest: the run stopped short, we
    // know the id to continue by, and the agent that ran it is still the one the board
    // runs — resuming a Claude Code conversation under another agent would hand it an id
    // that means nothing there.
    canResume: canPickUp(r) && !!resumeIdOf(r) && !!resumable && r.harness === resumable,
  }
}

/** Every run the board knows about, oldest first. Reaping happens here, which is why this
 *  writes: a run whose watcher died has to stop reading as live for everyone, not just for
 *  whoever noticed. */
export async function listRuns(): Promise<RunView[]> {
  const reaped: RunRecord[] = []
  const restore: RunRecord[] = []
  const runs = withRuns((all) => {
    reap(all, reaped, restore)
    return all.map((r) => ({ ...r }))
  })
  // Both outside the record's lock. The card's stage first, then the delivery: a run reaped
  // here ended out of everyone's sight, so this is where its delivery is told — and its
  // permanent record is the only place that ending is written down.
  for (const run of restore) await restoreCardStatus(run)
  for (const run of reaped) await settleDelivery(run)
  const resumable = resumableHarness() // one settings read for the whole list
  return runs.map((r) => toView(r, resumable))
}

/** One run by id, or by any prefix of one that names exactly one run. `last` is the newest
 *  run of all — the one you almost always mean right after starting something. */
export function findRun(runs: RunRecord[], id: string): RunRecord | undefined | null {
  const key = id.trim()
  if (!key) return undefined
  if (key === 'last') return runs[runs.length - 1]
  const exact = runs.find((r) => r.sessionId === key)
  if (exact) return exact
  const hits = runs.filter((r) => r.sessionId.startsWith(key))
  if (hits.length === 1) return hits[0]
  // More than one — null says "ambiguous", which is a different answer from "no such run".
  return hits.length > 1 ? null : undefined
}

/** One run with its log read from the file, or null when no run answers to that id. */
export async function getRun(id: string, bytes?: number): Promise<RunView | null> {
  const restore: RunRecord[] = []
  const runs = withRuns((all) => {
    reap(all, [], restore)
    return all.map((r) => ({ ...r }))
  })
  for (const run of restore) await restoreCardStatus(run)
  const found = findRun(runs, id)
  if (!found) return null
  const view = toView(found, resumableHarness())
  const raw = readLogTail(found.logPath, bytes) ?? ''
  const { tail, result, durationMs, costUsd, model, usage } = splitLog(raw)
  view.tail = tail
  // The record wins where it has an answer; the stamps in the log are what is left for a
  // run whose record has been trimmed down to nothing but its file.
  if (result && found.status !== 'running' && !view.result) view.result = result
  if (view.durationMs === undefined && durationMs !== undefined && found.status !== 'running') {
    view.durationMs = durationMs
  }
  if (view.costUsd === undefined && costUsd !== undefined && found.status !== 'running') {
    view.costUsd = costUsd
  }
  if (view.usage === undefined && usage !== undefined && found.status !== 'running') view.usage = usage
  if (view.model === undefined && model !== undefined) view.model = model
  return view
}

// ---- starting --------------------------------------------------------------

// The locks every new run passes, whether it's a fresh action or a resumed one: one live
// run per card, and one live create/propose/plan-release across the whole board. Checked
// with the record's lock held, so two processes can't both slip past.
function lockedBy(
  runs: RunRecord[],
  action: AgentAction,
  cardId: number | null,
  release?: string,
): string | undefined {
  // A spec agent is out of that rule at both ends: it fills one section and never the
  // plan, so it neither takes the card nor waits for one. Two agents may work a card —
  // they write different sections — and a card being refined can still have its screen
  // drawn. Two runs writing one card file at the same moment is the problem #156 owns,
  // and it is that problem whether or not this rule pretends otherwise.
  if (cardId !== null && action !== 'spec') {
    const live = runs.find((r) => r.status === 'running' && r.cardId === cardId && r.action !== 'spec')
    if (live) return `#${cardId} is already being ${VERB[live.action]}`
  }
  if (SINGLETON_ACTIONS.has(action)) {
    const live = runs.find((r) => r.status === 'running' && r.action === action)
    if (live) return SINGLETON_BUSY[action] ?? `a task is already being ${VERB[action]}`
  }
  // One changelog per version, not one across the board: two runs on two versions write two
  // different files, and only two on the SAME version would write over each other. The
  // version a run is for is its input, which is what it was written down as.
  if (action === 'changelog' && release) {
    const live = runs.find((r) => r.status === 'running' && r.action === 'changelog' && r.input === release)
    if (live) return `a changelog for ${release} is already being written`
  }
  return undefined
}

/** Why this card can't be changed from outside a run this second — a live run is working on
 *  it — or nothing when it is free. The sentence names the card and what that run is doing,
 *  because "try again later" without either is a refusal nobody can act on.
 *
 *  A spec run holds nothing: it fills one section of the card and never the plan, which is
 *  the same rule `lockedBy` follows when it decides whether a run may start.
 *
 *  Read through `listRuns`, so a run whose process died has already stopped counting as
 *  live. That read takes the record's lock and may reach for the board's, so this is asked
 *  BEFORE the board's own lock is taken, never while it is held. */
export async function heldByRun(cardId: number): Promise<string | undefined> {
  const live = (await listRuns()).find(
    (r) => r.status === 'running' && r.cardId === cardId && r.action !== 'spec',
  )
  if (!live) return undefined
  return (
    `#${cardId} is being ${VERB[live.action]} by run ${live.sessionId.slice(0, 8)} right now, ` +
    `so the board won't change it. Wait for that run to end, or stop it.`
  )
}

// The text the user typed for a run, pulled from whichever field carries it. A plan-release
// or changelog run was never given text — the user named a version, and that version is what
// the run is about, so it stands in. It is also what tells two changelog runs apart, so the
// second one on the same version can be refused.
function runInput(req: AgentRequest): string | undefined {
  const text =
    req.action === 'plan-release' || req.action === 'changelog'
      ? req.release ?? ''
      : req.description ?? req.reason ?? req.notes ?? ''
  return text.trim() || undefined
}

/** The title of the card a run names, so its prompt can say what the task is called. */
export function titleOf(cardId: number | undefined): string | undefined {
  if (!Number.isInteger(cardId)) return undefined
  return cardNow(cardId as number)?.title
}

/** Write a run down and hand back everything the watcher needs to start it. The run is
 *  `running` from this moment: it holds its card, and a second one on the same card is
 *  refused from here on, whichever process asks.
 *
 *  Nothing is spawned here — that is `spawnWatcher`, which the command does right after,
 *  and `markSpawned` is how the pid gets back into the record. */
export function openRun(
  req: AgentRequest,
  prompt: string,
  notes: string[] = [],
): { run: RunRecord; spec: RunSpec } | { error: string } {
  const cardId = Number.isInteger(req.id) ? (req.id as number) : null
  const sessionId = randomUUID()
  // A build with no delivery on its card opens one, and a delivery is got ready before
  // anything is written down (#303): the commit mode is decided, the checkout is checked,
  // and the worktree is made. A refusal here costs nothing, and whatever it made is undone
  // below if the run is refused after it.
  let start: DeliveryStart | undefined
  if (cardId !== null && req.action === 'implement' && !activeDelivery(cardId)) {
    const prepared = prepareDelivery(cardId)
    if ('error' in prepared) return { error: prepared.error }
    start = prepared.start
  }
  // Where this run works: its delivery's own worktree, or the project itself.
  const joining = cardId !== null && DELIVERY_FLOWS.has(req.action) ? activeDelivery(cardId) : undefined
  const cwd = deliveryCwd(start ?? joining ?? {})
  // The one settings read for this whole run. Everything it needs is worked out here, at
  // the start — not later, when the agent finally spawns (an index action waits its turn
  // first, and the picker may well have been flipped by then). A run therefore always uses
  // one agent end to end: its command, its flags, and the name recorded against it.
  const plan = planRun(sessionId, cwd)
  const record: RunRecord = {
    sessionId,
    cardId,
    action: req.action,
    status: 'running',
    startedAt: Date.now(),
    input: runInput(req),
    harness: plan.harness,
    // No `resumeId` here on purpose. A fresh run under an agent that takes our id needs
    // none, and one that mints its own has nothing to record yet.
    logPath: logPathOf(sessionId),
    // Which spec agent this is, on the one action that has one — so the run list can name
    // it, and so a resume starts the same agent rather than a different one.
    specAgent: req.action === 'spec' ? req.specAgent : undefined,
    // Internal refinement sessions carry their position so the watcher can choose the next
    // QA or writing session. A standalone resolve starts a new chain.
    refineRound: req.refineRound ?? (REFINE_ACTIONS.has(req.action) ? 1 : undefined),
    // And the loop they belong to. The pass that starts one is given an id here — the
    // watcher copies it onto every pass after it — so a refinement is one thing in the
    // record however many sessions it takes, and a second refine on the same card is never
    // mistaken for a continuation of the first.
    flowId: REFINE_ACTIONS.has(req.action) ? (req.flowId ?? randomUUID()) : undefined,
  }
  const out = withStore<{ run: RunRecord } | { error: string }>((store) => {
    const locked = lockedBy(store.runs, req.action, cardId, req.release)
    if (locked) return { error: locked }
    store.runs.push(record)
    // A delivery's own runs belong to a delivery — the one already in flight on this
    // card, or, for a build, a new one opened here. Same transaction as the run it
    // belongs to, so a delivery can never be left holding a card with nothing working on
    // it. Review and legacy correction join an existing delivery and never open one: there is
    // nothing to review until something has been built.
    if (cardId !== null && DELIVERY_FLOWS.has(req.action)) {
      if (req.action === 'implement') {
        joinDelivery(store, record, req.title ?? cardNow(cardId)?.title ?? '', 'implement', start)
      } else if (!joinActive(store, record, req.action)) {
        store.runs.pop()
        return { error: `no delivery is in flight on #${cardId}, so there is nothing to ${req.action}` }
      }
    }
    return { run: record }
  })
  if ('error' in out) {
    // Refused after the delivery was got ready — take its worktree back rather than leave
    // a checkout behind for a delivery that never started.
    if (start) undoPrepared(start)
    return out
  }
  const spec: RunSpec = { sessionId, plan, prompt, ...(notes.length ? { notes } : {}) }
  writeSpec(spec)
  return { run: record, spec }
}

/** Write a resumed run down: one more turn of a conversation that already happened, on the
 *  same card and under the same action, so the card rule and the shared-file rule apply
 *  exactly as they did the first time.
 *
 *  It REPLACES the run it continues: once it has started, the old record is dropped and
 *  its log deleted. The two are one piece of work — the same conversation, carried on — so
 *  the list keeps one row for it, the one that is still going. The cost is that the earlier
 *  run's log goes with it; `resumedFrom` survives as the mark of where this run began. */
export async function openResume(id: string): Promise<{ run: RunRecord; spec: RunSpec } | { error: string }> {
  const restore: RunRecord[] = []
  const runs = withRuns((all) => {
    reap(all, [], restore)
    return all.map((r) => ({ ...r }))
  })
  for (const run of restore) await restoreCardStatus(run)
  const prev = findRun(runs, id)
  if (prev === null) return { error: `"${id}" matches more than one run — give more of the id` }
  if (!prev) return { error: `no run here answers to "${id}"` }
  if (prev.status === 'running') return { error: 'that run is still going' }
  if (!canPickUp(prev)) return { error: 'only a failed, interrupted or stopped run can be continued' }
  const resumeId = resumeIdOf(prev)
  if (!resumeId) return { error: 'that run never reported a session id to continue by' }
  // Resumed where the run it continues worked: a delivery's own worktree, or the project
  // itself.
  const resuming = prev.deliveryId ? findDelivery(prev.deliveryId) : undefined
  const plan = planResume(prev.harness, resumeId, deliveryCwd(resuming ?? {}))
  if (!plan) return { error: `the agent the board runs now can't continue a ${prev.harness || 'earlier'} session` }

  const sessionId = randomUUID()
  const record: RunRecord = {
    sessionId,
    cardId: prev.cardId,
    action: prev.action,
    status: 'running',
    startedAt: Date.now(),
    // No `input`: the note the user typed is already in the conversation being resumed —
    // repeating it would read as a second instruction they never gave.
    harness: plan.harness,
    resumeId: plan.resumeId ?? undefined,
    resumedFrom: prev.sessionId,
    logPath: logPathOf(sessionId),
    specAgent: prev.specAgent,
    refineRound: prev.refineRound,
    // The same refinement carried on, not a second one — the way a resume re-joins the
    // delivery it continues rather than opening another.
    flowId: prev.flowId,
  }
  const out = withStore<{ run: RunRecord } | { error: string }>((store) => {
    const all = store.runs
    const locked = lockedBy(all, prev.action, prev.cardId, prev.input)
    if (locked) return { error: locked }
    all.push(record)
    // Resume carries the DELIVERY on, rather than starting a second one: one delivery id
    // covers both runs, and the flow is re-entered so each step checks its own
    // precondition — the finished work is not done again, because the step that would
    // redo it finds its precondition already met.
    const delivery = store.deliveries.find((d) => d.deliveryId === prev.deliveryId && d.status === 'active')
    if (delivery) {
      delivery.sessions.push(record.sessionId)
      delivery.steps.push({ step: 'resume', at: record.startedAt })
      record.deliveryId = delivery.deliveryId
    }
    // The new run has the conversation now, so the old record goes — after every refusal
    // above, never before one. A resume that couldn't start leaves the run it would have
    // continued exactly as it was.
    const at = all.findIndex((r) => r.sessionId === prev.sessionId)
    if (at >= 0) all.splice(at, 1)
    return { run: record }
  })
  if ('error' in out) return out
  if (record.deliveryId) syncAudit(record.deliveryId)
  // The asks the run being taken over collected come with it. It never got as far as
  // starting them — that is why it is being resumed — and the flow asked once.
  const inherited = readSpecAsks(prev.sessionId)
  for (const ask of inherited) askForSpec(sessionId, ask)
  clearSpecAsks(prev.sessionId)
  try {
    fs.unlinkSync(prev.logPath)
  } catch {
    // already pruned, or never written — the record is gone either way
  }
  const spec: RunSpec = { sessionId, plan, prompt: '' } // the prompt is the watcher's
  writeSpec(spec)
  return { run: record, spec }
}

/** Ask for a spec agent from inside a run.
 *
 *  A run never starts another, so nothing spawns here: the ask is written into the asking
 *  run's own asks file, and that run's watcher starts it once the run has ended
 *  (`readSpecAsks`). That is also what keeps a spec agent clean — by the time it starts,
 *  the conversation that wanted it is over, so there is nothing of it to inherit.
 *
 *  `already` means this run has asked for that agent on that card before; a second ask
 *  would be the same run twice. */
export function askForSpec(sessionId: string, ask: SpecAsk): 'queued' | 'already' | 'no-run' {
  if (!peekRun(sessionId)) return 'no-run'
  const asks = readSpecAsks(sessionId)
  if (asks.some((a) => a.specAgent === ask.specAgent && a.cardId === ask.cardId)) return 'already'
  asks.push(ask)
  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  const tmp = `${asksPathOf(sessionId)}.tmp`
  fs.writeFileSync(tmp, JSON.stringify({ asks }, null, 2) + '\n')
  fs.renameSync(tmp, asksPathOf(sessionId))
  return 'queued'
}

/** The spec agents this run has been asked for. Empty when it was asked for none, and
 *  empty rather than thrown when the file is damaged: a run's own ending must not fail on
 *  the follow-up it was going to start. A malformed entry is dropped rather than started —
 *  an ask names an agent and a card, and half of one names neither. */
export function readSpecAsks(sessionId: string): SpecAsk[] {
  let data: unknown
  try {
    data = JSON.parse(fs.readFileSync(asksPathOf(sessionId), 'utf8'))
  } catch {
    return []
  }
  const raw = (data as { asks?: unknown })?.asks
  if (!Array.isArray(raw)) return []
  return raw.flatMap((entry) => {
    const a = entry as Partial<SpecAsk>
    if (!a || typeof a.specAgent !== 'string' || !a.specAgent || !Number.isInteger(a.cardId)) return []
    return [{ specAgent: a.specAgent, cardId: a.cardId as number, notes: typeof a.notes === 'string' ? a.notes : undefined }]
  })
}

/** Forget a run's asks — once they have been started, and when the run they were written
 *  for is taken over by a resume. */
export function clearSpecAsks(sessionId: string): void {
  try {
    fs.unlinkSync(asksPathOf(sessionId))
  } catch {
    // never written, or already gone
  }
}

/** Record the process now watching a run, so a stop can reach it and a reader can tell a
 *  live run from one that was cut off. */
export function markSpawned(sessionId: string, pid: number | undefined): void {
  patch(sessionId, (r) => {
    if (r.status === 'running') r.pid = pid
  })
}

/** Change one run in place, under the record's lock. */
export function patch(sessionId: string, change: (run: RunRecord) => void): RunRecord | undefined {
  return withRuns((runs) => {
    const run = runs.find((r) => r.sessionId === sessionId)
    if (run) change(run)
    return run ? { ...run } : undefined
  })
}

/** One run as it stands right now, without reaping or locking. */
export function peekRun(sessionId: string): RunRecord | undefined {
  return readRuns().find((r) => r.sessionId === sessionId)
}

/** Close a run out: its outcome, the card's stage put back, a recurring card stamped, and
 *  the old logs trimmed. Whichever path gets here first wins and the rest are no-ops. */
export async function closeRun(
  sessionId: string,
  res: {
    status: RunStatus
    ok?: boolean
    code?: number | null
    error?: string
    note?: string
    endedAt?: number
  },
): Promise<void> {
  const closed = withRuns((runs) => {
    const run = runs.find((r) => r.sessionId === sessionId)
    if (!run || run.status !== 'running') return undefined
    run.status = res.status
    if (res.ok !== undefined) run.ok = res.ok
    run.code = res.code ?? null
    if (res.error) run.error = res.error
    if (res.note) run.note = res.note
    run.endedAt = res.endedAt ?? Date.now()
    run.pid = undefined
    return { ...run }
  })
  if (!closed) return
  // The delivery first: a run ending is a decision for the delivery it belongs to, and
  // whether the delivery is over is what decides whether the card is still being built.
  // Restoring the stage before that would read a delivery that was about to end as one
  // still in flight, and leave the card at `implementing` with nothing working on it.
  await settleDelivery(closed)
  await restoreCardStatus(closed)
  await recordRecurringRun(closed)
  dropSpec(sessionId)
  pruneLogs()
}

/** Ask a run to end. The watcher is signalled; the record is marked so whichever path
 *  witnesses the end — the watcher's own close, or a later reap — records `stopped` rather
 *  than a failure.
 *
 *  Stopping a run that has already ended does nothing and reports no error: a run list can
 *  be a moment old, so the run may well have finished between the read and the ask. */
export async function stopRun(id: string): Promise<StartResult> {
  const restore: RunRecord[] = []
  const out = withRuns((runs) => {
    reap(runs, [], restore)
    const run = findRun(runs, id)
    if (run === null) return { ok: false, error: `"${id}" matches more than one run — give more of the id` }
    if (!run) return { ok: false, error: `no run here answers to "${id}"` }
    if (run.status !== 'running') return { ok: true, sessionId: run.sessionId }
    run.stopping = true
    return { ok: true, sessionId: run.sessionId, pid: run.pid, live: true }
  })
  for (const run of restore) await restoreCardStatus(run)
  const live = out as StartResult & { pid?: number; live?: boolean }
  if (!live.ok || !live.live) return { ok: live.ok, sessionId: live.sessionId, error: live.error }
  if (live.pid) {
    try {
      process.kill(live.pid, 'SIGTERM')
    } catch {
      // gone between the read and the signal — the run is over either way, which is what
      // stopping wanted
    }
  } else {
    // Nothing to signal: the run is queued behind the shared-file lock and has not spawned
    // a watcher yet, or it died a moment ago. Nothing will ever tell us it ended.
    await closeRun(live.sessionId!, { status: 'stopped', code: null })
  }
  return { ok: true, sessionId: live.sessionId }
}

/** Cancel a delivery: end it, stop whatever run it has going, and hand the card
 *  back. Whatever the delivery wrote is left exactly where it is — the board never undoes
 *  work; `discard` is what reclaims a worktree, and what the card page offers (#313). This
 *  is the CLI-only way out for anyone who wants the branch kept.
 *
 *  Named by delivery id, by any prefix of one, or by the card it is building. Cancelling
 *  one that has already ended is not an error: the button is drawn from a poll that can be
 *  a second and a half stale.
 *
 *  The delivery is ended BEFORE the run is stopped, so the card is free from the first
 *  moment and nothing can slip a second delivery in behind the stop. */
export async function cancelDelivery(id: string): Promise<{ ok: boolean; deliveryId?: string; error?: string }> {
  if (!id.trim()) return { ok: false, error: 'name the delivery to cancel' }
  const delivery = namedDelivery(id)
  if (!delivery) return { ok: false, error: `no delivery here answers to "${id}"` }
  if (delivery.status !== 'active') return { ok: true, deliveryId: delivery.deliveryId }
  endDelivery(delivery.deliveryId, 'cancelled')
  // A delivery that has ended must not still be writing files.
  const live = readRuns().find((r) => r.status === 'running' && r.deliveryId === delivery.deliveryId)
  if (live) await stopRun(live.sessionId)
  // Whether or not there was one to stop: nothing is building this card now.
  await releaseCard(delivery.cardId)
  // Last, so the permanent record carries how that run actually ended rather than the
  // state it was in when the cancel arrived.
  syncAudit(delivery.deliveryId)
  return { ok: true, deliveryId: delivery.deliveryId }
}

/** What discarding this delivery would take away — its worktree and its branch — or
 *  nothing when it holds neither. The card page and the command both say this before they
 *  ask, so nothing is removed by a command that only meant to look. */
export function discardCost(id: string): { deliveryId: string; worktree?: string; branch?: string } | null {
  const delivery = namedDelivery(id)
  if (!delivery?.worktree) return null
  return { deliveryId: delivery.deliveryId, worktree: delivery.worktree, branch: delivery.branch }
}

/** Discard a delivery: end it if it is still in flight, then remove its worktree and its
 *  branch. The one thing on this board that throws work away, so nothing calls it on its
 *  own — a person asks for it, having been told what will be lost.
 *
 *  It never reaches the user's main checkout: only a path inside `.akb/` is ever removed
 *  (agent/worktree.ts). */
export async function discardDelivery(id: string): Promise<{ ok: boolean; deliveryId?: string; error?: string }> {
  if (!id.trim()) return { ok: false, error: 'name the delivery to discard' }
  const delivery = namedDelivery(id)
  if (!delivery) return { ok: false, error: `no delivery here answers to "${id}"` }
  if (delivery.status === 'active') {
    const cancelled = await cancelDelivery(delivery.deliveryId)
    if (!cancelled.ok) return cancelled
  }
  const removed = removeWorktree(delivery.worktree, delivery.branch, true)
  if (!removed.ok) return { ok: false, deliveryId: delivery.deliveryId, error: removed.error }
  withStore((store) => {
    const live = store.deliveries.find((d) => d.deliveryId === delivery.deliveryId)
    if (!live) return
    live.worktree = undefined
    live.branch = undefined
  })
  syncAudit(delivery.deliveryId)
  return { ok: true, deliveryId: delivery.deliveryId }
}

/** Deliveries whose worktree or branch has gone missing since they were written down —
 *  someone deleted the folder, or pruned the branch. Reported, never started over: a
 *  delivery that quietly forked a second worktree would build the card twice.
 *
 *  It also clears git's own metadata for worktree paths that are already missing, which is
 *  all `git worktree prune` ever does — it never decides a delivery's directory is safe to
 *  delete. */
export function repairDeliveries(): string[] {
  pruneWorktreeMetadata()
  // A landing a crash left half-done first: a rebase stopped part-way through with nothing
  // working on it is put back, and the slot it was holding goes with it (#304).
  const complaints: string[] = [...repairLanding()]
  for (const d of listDeliveries()) {
    if (d.status !== 'active' || !d.worktree) continue
    const lostTree = !worktreeExists(d.worktree)
    const lostBranch = !branchExists(d.branch)
    if (!lostTree && !lostBranch) continue
    const gone = lostTree && lostBranch ? 'worktree and branch are' : lostTree ? 'worktree is' : 'branch is'
    complaints.push(
      `delivery ${d.deliveryId} on #${d.cardId}: its ${gone} gone (${d.worktree}${d.branch ? `, ${d.branch}` : ''}). ` +
        `Discard it and start the card again — nothing will rebuild it on its own.`,
    )
  }
  return complaints
}

// ---- the plan a watcher picks up -------------------------------------------

function writeSpec(spec: RunSpec): void {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  fs.writeFileSync(specPathOf(spec.sessionId), JSON.stringify(spec, null, 2) + '\n')
}

export function readSpec(sessionId: string): RunSpec | null {
  try {
    const spec = JSON.parse(fs.readFileSync(specPathOf(sessionId), 'utf8')) as RunSpec
    return spec && Array.isArray(spec.plan?.argv) ? spec : null
  } catch {
    return null
  }
}

function dropSpec(sessionId: string): void {
  try {
    fs.unlinkSync(specPathOf(sessionId))
  } catch {
    // never written, or already gone
  }
}

// Keep only the newest logs on disk; delete older ones. The record already drops a run
// whose log has gone, so the two shrink together.
function pruneLogs(): void {
  try {
    const files = fs
      .readdirSync(SESSIONS_DIR)
      .filter((f) => f.endsWith('.log'))
      .map((f) => ({ f, t: fs.statSync(path.join(SESSIONS_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t)
    for (const { f } of files.slice(KEEP_LOGS)) {
      try {
        fs.unlinkSync(path.join(SESSIONS_DIR, f))
      } catch {
        // ignore
      }
    }
  } catch {
    // no folder yet, nothing to prune
  }
}

// ---- the shared-file lock, across processes --------------------------------

/** True when this action rewrites the board's shared files, and so may only run one at a
 *  time across every process on this board. */
export const needsIndexLock = (action: AgentAction): boolean => INDEX_ACTIONS.has(action)

// How long a queued run waits for its turn before giving up. A propose or a plan-release
// ahead of it is a real agent run, so this is measured in the length of one of those, not
// in the milliseconds a board write takes.
const INDEX_WAIT_MS = 60 * 60_000
const INDEX_POLL_MS = 500

/** Wait for the shared-file lock and hand back the release. Polls instead of blocking, so
 *  the waiting process can still answer a stop while it queues. `giveUp` is asked on every
 *  turn — a run stopped while queued never spawns. */
export async function acquireIndexLock(giveUp: () => boolean): Promise<(() => void) | null> {
  const until = Date.now() + INDEX_WAIT_MS
  const holder = path.join(INDEX_LOCK, 'holder')
  for (;;) {
    if (giveUp()) return null
    try {
      fs.mkdirSync(INDEX_LOCK, { recursive: false })
      fs.writeFileSync(holder, String(process.pid))
      return () => fs.rmSync(INDEX_LOCK, { recursive: true, force: true })
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ENOENT') {
        fs.mkdirSync(path.dirname(INDEX_LOCK), { recursive: true })
        continue
      }
      if (code !== 'EEXIST') throw err
      // Held. Whoever holds it writes their pid in; if that process is gone, so is their
      // claim — a run killed mid-flight must not lock the board out for good.
      if (!pidAlive(Number(readHolder(holder)))) {
        fs.rmSync(INDEX_LOCK, { recursive: true, force: true })
        continue
      }
      if (Date.now() > until) return null
      await sleep(INDEX_POLL_MS)
    }
  }
}

function readHolder(file: string): string {
  try {
    return fs.readFileSync(file, 'utf8').trim()
  } catch {
    // The folder exists but the pid file hasn't landed yet — a race of milliseconds. Read
    // it as alive so the waiter waits rather than breaking a lock that was just taken.
    return String(process.pid)
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
