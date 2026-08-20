// The one record of what is running.
//
// It is a file — docs/kanban/.sessions.json — because the processes that need it are not
// one process. A run started from a terminal, one started from a button, and one the board
// started on its own all land in the same list, and the rules that keep two of them off
// the same card hold across all three. Nothing is kept in memory between commands: every
// read is a read of the file, and every write takes the record's own lock.
//
// The record's lock is NOT the board's writing lock. A run's bookkeeping calls board moves
// — putting a card's stage back, stamping a recurring run — and those take the board lock
// themselves, so holding it here would deadlock.
//
// Alongside it sits docs/kanban/.sessions/: one log per run, and, while a run is starting,
// the plan it was started with. Both are the run's own; the record points at them.

import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { cmdUpdate } from '../../commands/card'
import { cmdRun } from '../../commands/misc'
import { locate } from '../cards'
import { parseFrontmatter } from '../frontmatter'
import { quietly } from '../io'
// pidAlive lives with the lock, which needs the same question answered about whoever holds it.
import { pidAlive, withBoardLock, withLock } from '../lock'
import { INDEX_LOCK, SESSIONS, SESSIONS_DIR, SESSIONS_LOCK } from '../paths'
import { asUsage, durationLine, KEEP_LOGS, readLogTail, splitLog } from './log'
import { adoptsSessionId, planResume, planRun, resumableHarness, type RunPlan } from './resolve'
import type { AgentAction, AgentRequest, RunRecord, RunStatus, RunView, SpecAsk } from './types'

/** How many finished runs the record keeps. The logs outlive them by the same count. */
const KEEP_RUNS = 30

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
  refine: 'refined',
  resolve: 'resolved',
  'plan-release': 'planned',
  setup: 'set up',
  spec: 'specified',
}

// The refusal a one-at-a-time action gets when one of its own is already going, where the
// "a task is already being …" sentence doesn't fit.
const SINGLETON_BUSY: Partial<Record<AgentAction, string>> = {
  'plan-release': 'a release is already being planned',
  setup: 'this board is already being set up',
}

// A run's action maps to the saved stage it puts the card in while it goes. Only implement
// sets one — the rest either refine the card or touch no resting card.
const RUN_STATUS: Partial<Record<AgentAction, string>> = { implement: 'implementing' }

/** Everything a watcher needs to start the run it was handed. Written beside the log so
 *  the command that starts a run and the process that runs it are not the same process. */
export interface RunSpec {
  sessionId: string
  plan: RunPlan
  prompt: string
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

// ---- the file --------------------------------------------------------------

export const logPathOf = (sessionId: string): string => path.join(SESSIONS_DIR, `${sessionId}.log`)
const specPathOf = (sessionId: string): string => path.join(SESSIONS_DIR, `${sessionId}.plan.json`)
// The spec agents a run asked for while it went, waiting for its watcher to start them.
const asksPathOf = (sessionId: string): string => path.join(SESSIONS_DIR, `${sessionId}.asks.json`)

// `auto-refine` was this action's name until refine became the loop and there was only one
// of them. A board's history outlives a version, so an old record still reads.
export const readAction = (action: unknown): AgentAction =>
  action === 'auto-refine' ? 'refine' : (action as AgentAction)

/** Every run the record holds, newest last. Reads only — no lock, because a half-written
 *  file is never what a reader sees: every write is atomic (write, then rename). */
export function readRuns(): RunRecord[] {
  let data: unknown
  try {
    data = JSON.parse(fs.readFileSync(SESSIONS, 'utf8'))
  } catch {
    return []
  }
  const box = data as { runs?: unknown; live?: unknown; finished?: unknown }
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
      action: readAction(entry.action),
      status: asStatus(entry.status),
      startedAt: typeof entry.startedAt === 'number' ? entry.startedAt : Date.now(),
      endedAt: typeof entry.endedAt === 'number' ? entry.endedAt : undefined,
      pid: typeof entry.pid === 'number' ? entry.pid : undefined,
      input: typeof entry.input === 'string' ? entry.input : undefined,
      ok: typeof entry.ok === 'boolean' ? entry.ok : undefined,
      code: entry.code ?? null,
      error: typeof entry.error === 'string' ? entry.error : undefined,
      // A run that never reported a cost shows none, rather than a zero it didn't earn.
      costUsd: typeof entry.costUsd === 'number' && entry.costUsd > 0 ? entry.costUsd : undefined,
      usage: asUsage(entry.usage),
      model: typeof entry.model === 'string' && entry.model ? entry.model : undefined,
      result: typeof entry.result === 'string' ? entry.result : undefined,
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
    })
  }
  return runs.sort((a, b) => a.startedAt - b.startedAt)
}

// A saved terminal state comes back as itself; anything unrecognized reads as `done`, the
// one state that claims nothing beyond "it ended".
function asStatus(value: unknown): RunStatus {
  return value === 'running' || value === 'error' || value === 'interrupted' || value === 'stopped'
    ? value
    : 'done'
}

function writeRuns(runs: RunRecord[]): void {
  const kept = prune(runs)
  fs.mkdirSync(path.dirname(SESSIONS), { recursive: true })
  const tmp = `${SESSIONS}.tmp`
  fs.writeFileSync(tmp, JSON.stringify({ runs: kept }, null, 2) + '\n')
  // Rename rather than write in place, so a reader never catches half a file.
  fs.renameSync(tmp, SESSIONS)
}

// Bound the record: keep every live run and the newest KEEP_RUNS finished ones, and drop a
// finished run whose log is already gone — its record would be a dead pointer.
function prune(runs: RunRecord[]): RunRecord[] {
  const live = runs.filter((r) => r.status === 'running')
  const finished = runs
    .filter((r) => r.status !== 'running' && fs.existsSync(r.logPath))
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, KEEP_RUNS)
  return [...live, ...finished].sort((a, b) => a.startedAt - b.startedAt)
}

/** Read the record, change it, write it back — with its lock held the whole way. Every
 *  writer goes through this, so two processes never lose each other's change. */
export function withRuns<T>(fn: (runs: RunRecord[]) => T): T {
  return withLock(SESSIONS_LOCK, "writing this board's run list", () => {
    const runs = readRuns()
    const before = JSON.stringify(runs)
    const out = fn(runs)
    // Only write when something moved. Every read goes through here — a board UI polls it
    // a couple of times a second — and rewriting the same file that often would be a lot
    // of churn for nothing.
    if (JSON.stringify(runs) !== before) writeRuns(runs)
    return out
  })
}

// ---- what is still alive ---------------------------------------------------

// A run whose watcher is gone was INTERRUPTED, never finished. Nobody witnessed its end, so
// there is no exit code, no final message, and no reason to believe the work is complete.
// It reads as unfinished and offers Resume.
//
// Unless a stop had already been asked for: then the process ending is the stop landing,
// and the run is `stopped`.
function reap(runs: RunRecord[]): boolean {
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
    restoreCardStatus(r)
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
// move. Best-effort and silent: if the card is gone (archived by the very run that just
// ended) or the board refuses, the run is over either way and its answer is elsewhere.
function boardMove(fn: () => void): void {
  try {
    withBoardLock(() => quietly(fn))
  } catch {
    // card removed, or the board refused — leave it as it is
  }
}

function setCardStatus(cardId: number, status: string): void {
  boardMove(() => cmdUpdate([String(cardId), '--status', status]))
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

/** Mark the card as being worked on, and remember the stage it had — so the end of the run
 *  puts back what was there rather than always dropping it to `todo`. */
export function claimCard(run: RunRecord): void {
  const wanted = run.cardId !== null ? RUN_STATUS[run.action] : undefined
  if (run.cardId === null || !wanted) return
  run.priorStatus = cardNow(run.cardId)?.status ?? 'todo'
  setCardStatus(run.cardId, wanted)
}

// When a run ends and its card still exists, restore the stage it had before — so a `ready`
// card is `ready` again, not knocked back to `todo`. Questions always win: if the run left
// the card with open questions, drop it to `todo` whatever the prior stage. If the run
// finished the task (archive/reject removed the card) this is a harmless no-op.
function restoreCardStatus(run: RunRecord): void {
  if (run.cardId === null || !RUN_STATUS[run.action]) return
  const card = cardNow(run.cardId)
  if (!card) return // archived or rejected — nothing to restore
  setCardStatus(run.cardId, card.questions > 0 ? 'todo' : run.priorStatus ?? 'todo')
}

// Recording a recurring run is the board's own bookkeeping, not part of the job the card
// describes — so the run does it at its close rather than asking the agent to stamp itself
// mid-flow. The stamp is what the cadence counts from, and leaving it to the agent meant a
// run that died on the last step left the card frozen.
//
// Only a run that PASSED is recorded. A failed, stopped or interrupted run never reached
// the end of the `## Process`, so `last_run` stays where it was and the card is still due.
function recordRecurringRun(run: RunRecord): void {
  if (run.action !== 'run' || run.cardId === null || run.status !== 'done') return
  boardMove(() => cmdRun(run.cardId as number))
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
export function listRuns(): RunView[] {
  const runs = withRuns((all) => {
    reap(all)
    return all.map((r) => ({ ...r }))
  })
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
export function getRun(id: string, bytes?: number): RunView | null {
  const runs = withRuns((all) => {
    reap(all)
    return all.map((r) => ({ ...r }))
  })
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
function lockedBy(runs: RunRecord[], action: AgentAction, cardId: number | null): string | undefined {
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
  return undefined
}

// The text the user typed for a run, pulled from whichever field carries it. A plan-release
// run was never given text — the user named a version, and that version is what the run is
// about, so it stands in.
function runInput(req: AgentRequest): string | undefined {
  const text =
    req.action === 'plan-release'
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
export function openRun(req: AgentRequest, prompt: string): { run: RunRecord; spec: RunSpec } | { error: string } {
  const cardId = Number.isInteger(req.id) ? (req.id as number) : null
  const sessionId = randomUUID()
  // The one settings read for this whole run. Everything it needs is worked out here, at
  // the start — not later, when the agent finally spawns (an index action waits its turn
  // first, and the picker may well have been flipped by then). A run therefore always uses
  // one agent end to end: its command, its flags, and the name recorded against it.
  const plan = planRun(sessionId)
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
  }
  const out = withRuns<{ run: RunRecord } | { error: string }>((runs) => {
    const locked = lockedBy(runs, req.action, cardId)
    if (locked) return { error: locked }
    runs.push(record)
    return { run: record }
  })
  if ('error' in out) return out
  const spec: RunSpec = { sessionId, plan, prompt }
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
export function openResume(id: string): { run: RunRecord; spec: RunSpec } | { error: string } {
  const runs = withRuns((all) => {
    reap(all)
    return all.map((r) => ({ ...r }))
  })
  const prev = findRun(runs, id)
  if (prev === null) return { error: `"${id}" matches more than one run — give more of the id` }
  if (!prev) return { error: `no run here answers to "${id}"` }
  if (prev.status === 'running') return { error: 'that run is still going' }
  if (!canPickUp(prev)) return { error: 'only a failed, interrupted or stopped run can be continued' }
  const resumeId = resumeIdOf(prev)
  if (!resumeId) return { error: 'that run never reported an id to continue by' }
  const plan = planResume(prev.harness, resumeId)
  if (!plan) return { error: `the agent the board runs now can't continue a ${prev.harness || 'earlier'} run` }

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
  }
  const out = withRuns<{ run: RunRecord } | { error: string }>((all) => {
    const locked = lockedBy(all, prev.action, prev.cardId)
    if (locked) return { error: locked }
    all.push(record)
    // The new run has the conversation now, so the old record goes — after every refusal
    // above, never before one. A resume that couldn't start leaves the run it would have
    // continued exactly as it was.
    const at = all.findIndex((r) => r.sessionId === prev.sessionId)
    if (at >= 0) all.splice(at, 1)
    return { run: record }
  })
  if ('error' in out) return out
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
export function closeRun(
  sessionId: string,
  res: { status: RunStatus; ok?: boolean; code?: number | null; error?: string; endedAt?: number },
): void {
  const closed = withRuns((runs) => {
    const run = runs.find((r) => r.sessionId === sessionId)
    if (!run || run.status !== 'running') return undefined
    run.status = res.status
    if (res.ok !== undefined) run.ok = res.ok
    run.code = res.code ?? null
    if (res.error) run.error = res.error
    run.endedAt = res.endedAt ?? Date.now()
    run.pid = undefined
    return { ...run }
  })
  if (!closed) return
  restoreCardStatus(closed)
  recordRecurringRun(closed)
  dropSpec(sessionId)
  pruneLogs()
}

/** Ask a run to end. The watcher is signalled; the record is marked so whichever path
 *  witnesses the end — the watcher's own close, or a later reap — records `stopped` rather
 *  than a failure.
 *
 *  Stopping a run that has already ended does nothing and reports no error: a run list can
 *  be a moment old, so the run may well have finished between the read and the ask. */
export function stopRun(id: string): StartResult {
  const out = withRuns((runs) => {
    reap(runs)
    const run = findRun(runs, id)
    if (run === null) return { ok: false, error: `"${id}" matches more than one run — give more of the id` }
    if (!run) return { ok: false, error: `no run here answers to "${id}"` }
    if (run.status !== 'running') return { ok: true, sessionId: run.sessionId }
    run.stopping = true
    return { ok: true, sessionId: run.sessionId, pid: run.pid, live: true }
  })
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
    closeRun(live.sessionId!, { status: 'stopped', code: null })
  }
  return { ok: true, sessionId: live.sessionId }
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
