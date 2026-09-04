// Starting a run, and everything you do to one afterwards: watch it, list them, stop one,
// continue one that stopped short.
//
// Every one of these commands returns as soon as it has done its bit. Starting prints the
// run's id and exits — the run outlives it — so the same run can be followed, stopped or
// continued from anywhere, by anyone, including a process that never saw it start.

import { activeDelivery, deliveryWaiting, heldByDelivery } from '../lib/agent/deliveries'
import { insideRun, printFlow } from '../lib/agent/flow'
import { spawnWatcher } from '../lib/agent/launch'
import { readLogTail, splitLog } from '../lib/agent/log'
import { refinementRequest, startRefinement } from '../lib/agent/refine'
import {
  askForRefine,
  discardCost,
  getRun,
  listRuns,
  markSpawned,
  openResume,
  stopRun,
  titleOf,
} from '../lib/agent/sessions'
import { startRun } from '../lib/agent/start'
import {
  PROPOSE_MAX,
  type AgentRequest,
  type CommandAction,
  type CommandRequest,
  type Boldness,
  type RefineEffort,
  type RunView,
} from '../lib/agent/types'
import { say } from '../lib/io'
import { die, BOARD_FLAG } from '../lib/paths'
import { holdCloudClaims } from '../lib/cloud/requests'
import { changelogRefusal } from '../lib/releases'
import { findCard } from '../lib/view/read'
import type { MoveResult } from '../lib/types'
import { approveDelivery, cancelDelivery, discardDelivery } from '../lib/view/api'

// How long a `--follow` waits between reads of a run's log. Short enough that the log
// reads as it happens, long enough that following a run is not a busy loop.
const FOLLOW_MS = 400

// ---- starting --------------------------------------------------------------

/** The one door every kind of run goes through: work out what was asked for, write it
 *  down, hand it to a watcher, and say which run started.
 *
 *  Or print the flow and start nothing — `--print`. An agent inside a run the board started
 *  always prints because a run never starts another. A chat follows the same choice as any
 *  coding-agent conversation: `--print` works here, and omitting it starts a run. */
export async function cmdStartRun(
  action: CommandAction,
  args: unknown[],
  opts: StartOptions,
  program = 'akb',
): Promise<MoveResult> {
  const { req, follow, print } = readRequest(action, args, opts)
  const runnable = action === 'refine' ? refinementRequest(req) : (req as AgentRequest)
  if ('error' in runnable) die(runnable.error, { kind: 'run-refused', action })
  const inside = insideRun()
  // Refine is the one flow a run hands work to rather than does itself: a revise makes the
  // change asked for and passes the card on. So it is written down here and started by this
  // run's watcher at the close — in the same flow, so it reads as the next session of the
  // job that handed the card over.
  if (inside && action === 'refine' && !print) return queueRefine(inside, req)
  if (inside || print) {
    if (!print) say(`inside run ${short(inside!)} — a run never starts another, so here is the flow instead.`)
    return printFlow(runnable, program)
  }
  sayBeforeStart(req, program)
  sayIfHeld(req, program)
  const started = action === 'refine' ? await startRefinement(req) : await startRun(runnable)
  if ('error' in started) die(started.error, { kind: 'run-refused', action })
  const { run, spawned } = started
  if (!spawned) die(`couldn't start a process for run ${run.sessionId}`, { kind: 'spawn-failed' })
  say(`${action} — run ${run.sessionId}${run.deliveryId ? ` in delivery ${run.deliveryId}` : ''}`)
  say(`  follow it: ${program} run log ${short(run.sessionId)} --follow${BOARD_FLAG}`)
  say(`  stop it:   ${program} run stop ${short(run.sessionId)}${BOARD_FLAG}`)
  if (follow) return { sessionId: run.sessionId, ...(await followRun(run.sessionId, '', program)) }
  return { sessionId: run.sessionId, action, cardId: run.cardId }
}

// Handing a card to a refinement from inside a run. Nothing spawns here — a run never
// starts another — and nothing of this conversation is passed on: the refinement reads the
// card, not the run that rewrote it.
function queueRefine(inside: string, req: CommandRequest): MoveResult {
  // A delivery holds its card here even against its own runs, which the hold usually lets
  // through: what is being written down is a session that starts AFTER this one, and the
  // delivery will still be in flight — reviewing what it built — when it does.
  const held = activeDelivery(req.id as number)
  if (held) {
    die(`delivery ${held.deliveryId} is in flight on #${req.id}, so it is not a card to hand over.`, {
      kind: 'run-refused',
      action: 'refine',
    })
  }
  const queued = askForRefine(inside, {
    cardId: req.id as number,
    notes: req.notes,
    effort: req.refineEffort,
  })
  if (queued === 'no-run') {
    die(`run ${short(inside)} is not on this board's list, so the ask has nowhere to be written down`, {
      kind: 'no-such-run',
      run: inside,
    })
  }
  say(
    queued === 'already'
      ? `#${req.id} has already been handed to a refinement — one ask is enough; it starts when this run ends.`
      : `#${req.id} handed to a refinement. It starts when this run ends — don't wait for it, and don't refine the card yourself.`,
  )
  return { action: 'refine', cardId: req.id, queued: queued === 'queued', pending: true }
}

// The actions a delivery holds its card against. Each one either rewrites the sections the
// delivery is building from — revise, refine and resolve all do — or takes the card off the
// board under it. What is NOT here is the delivery's own work: `implement` reaches the
// per-card run rule instead, and a resume carries the delivery on rather than starting
// against it.
//
// The hold is the board's, not one screen's: the card page turns the same five controls off
// (kanban-ui/components/CardPage.tsx), and a run of the delivery itself passes both.
const HELD_BY_DELIVERY = new Set<CommandAction>(['edit', 'refine', 'resolve', 'reject', 'archive'])

function sayIfHeld(req: CommandRequest, program: string): void {
  if (!HELD_BY_DELIVERY.has(req.action) || req.id === undefined) return
  // One way through: a delivery whose review stopped is waiting on a question it put on
  // this card, so answering that question is the very thing the hold would otherwise
  // block. Resolve rewrites questions and never the approved copy, so the delivery is
  // building exactly what it was building before (#302).
  if (req.action === 'resolve' && deliveryWaiting(req.id)) return
  const held = heldByDelivery(req.id, program)
  if (held) die(held, { kind: 'run-refused', action: req.action })
}

// Building a card whose blockers are still open is allowed — you named the id, so you meant
// it — but it is said out loud first. The board's own picks skip these cards entirely, so a
// run on one only ever comes from a person, and the usual reason is a blocker they forgot.
// Only building counts: refining a card before its blocker clears is ordinary work.
//
// An open question is warned about the same way (#307), and for the same reason: the
// delivery is started, builds and is reviewed, and then holds at landing until the question
// is answered. The card page's Implement dialog says exactly this; the terminal was the
// only side of the click missing it.
function sayBeforeStart(req: CommandRequest, program: string): void {
  if (req.action !== 'implement' && req.action !== 'run') return
  if (req.id === undefined) return
  const card = findCard(req.id)
  const blockers = card?.openBlockers ?? []
  if (blockers.length) {
    say(`#${req.id} is blocked by ${blockers.map((b) => `#${b.id} ${b.title}`).join(', ')} — starting anyway.`)
  }
  const asked = card?.questions.length ?? 0
  if (req.action === 'implement' && asked) {
    say(
      `#${req.id} has ${asked} open question${asked === 1 ? '' : 's'} — it is built and reviewed, then holds at landing ` +
        `until ${asked === 1 ? 'it is' : 'they are'} answered. Answer first with \`${program} card resolve ${req.id}\`.`,
    )
  }
}

/** Every flow's own options, as its command declares them (lib/agent/flows.ts). Each flow
 *  takes a few of these; none takes them all. */
export interface StartOptions {
  print?: boolean
  follow?: boolean
  release?: string
  module?: string
  count?: number
  boldness?: Boldness
  effort?: RefineEffort
  andImplement?: boolean
}

// Turn what was typed into the request the run is started from. The command line has been
// read already: which words are actions, which values `--boldness` accepts, whether
// `--count` is a number in range and that `--print` and `--follow` cannot both be given are
// all its command's own checks. What is left here is the shape of the request.
function readRequest(
  action: CommandAction,
  args: unknown[],
  opts: StartOptions,
): { req: CommandRequest; follow: boolean; print: boolean } {
  const follow = opts.follow === true
  const print = opts.print === true
  const words = (at: number): string | undefined => {
    const value = args[at]
    const text = Array.isArray(value) ? value.join(' ') : typeof value === 'string' ? value : ''
    return text.trim() || undefined
  }

  // The five actions that name no card. Three name nothing at all; planning a release and
  // writing one up each name a version.
  if (action === 'create') {
    return { req: { action, description: words(0)!, release: opts.release }, follow, print }
  }
  if (action === 'propose') {
    return { req: { action, module: opts.module, count: opts.count, boldness: opts.boldness }, follow, print }
  }
  if (action === 'plan-release') {
    return { req: { action, release: words(0)! }, follow, print }
  }
  // Writing one closed version's changelog (#232). Refused here rather than left to the
  // agent when the version has no closed record or shipped nothing: there is no changelog
  // to be had either way, and a run that only reads that and stops costs money for nothing.
  if (action === 'changelog') {
    const release = words(0)!
    const refusal = changelogRefusal(release)
    if (refusal) die(refusal, { kind: 'no-changelog', release })
    return { req: { action, release }, follow, print }
  }
  // The last of them: setting the board up names nothing at all. The checklist says what is left.
  if (action === 'setup') return { req: { action }, follow, print }

  // Everything else works on one card.
  const id = args[0] as number
  const req: CommandRequest = { action, id, title: titleOf(id) }
  if (action === 'reject') req.reason = words(1)
  else req.notes = words(1)
  if (action === 'refine') req.refineEffort = opts.effort
  if (action === 'resolve' && opts.andImplement === true) req.andImplement = true
  return { req, follow, print }
}

/** Send one more turn into a run that stopped short: same agent, same conversation, same
 *  card — and the prompt is just "carry on". */
export async function cmdResume(id: string | undefined, opts: { follow?: boolean }): Promise<MoveResult> {
  const opened = await openResume(id ?? 'last')
  if ('error' in opened) die(opened.error, { kind: 'run-refused' })
  const { run } = opened
  const pid = spawnWatcher(run.sessionId)
  markSpawned(run.sessionId, pid)
  if (!pid) die(`couldn't start a process for run ${run.sessionId}`, { kind: 'spawn-failed' })
  say(`continuing ${short(run.resumedFrom!)} — run ${run.sessionId}${run.deliveryId ? ` in delivery ${run.deliveryId}` : ''}`)
  if (opts.follow === true) return { sessionId: run.sessionId, ...(await followRun(run.sessionId)) }
  return { sessionId: run.sessionId, resumedFrom: run.resumedFrom }
}

/** Take a card back from the delivery in flight on it: the delivery ends as cancelled, its
 *  running run is stopped, the card unlocks, and Implement is offered again. Whatever
 *  the delivery wrote stays exactly where it is. */
export async function cmdCancel(named: string): Promise<MoveResult> {
  const res = await cancelDelivery(named)
  if (!res.ok) die(res.error ?? 'that delivery could not be cancelled', { kind: 'run-refused' })
  say(`delivery ${res.deliveryId} cancelled — the card is yours again.`)
  return { deliveryId: res.deliveryId }
}

/** Approve the tree a delivery would land (#308), so it may leave the landing queue's
 *  waiting room. Only a board with **Approve diffs before landing** on has anything
 *  to approve.
 *
 *  The approval covers the delivery's base commit and the tree built on it as they stand
 *  right now, so read the diff first — `akb run log` and the card page's **Diff** tab both show
 *  it. Either one moving afterwards cancels the approval by itself. */
export async function cmdApprove(named: string): Promise<MoveResult> {
  const res = await approveDelivery(named, 'akb delivery approve')
  if (!res.ok) die(res.error ?? 'that delivery could not be approved', { kind: 'run-refused' })
  say(`delivery ${res.deliveryId} approved — ${res.covers}.`)
  say('It lands from here. Change the tree or the commit it forked from and the approval is cancelled.')
  return { deliveryId: res.deliveryId, approved: true }
}

/** Throw a delivery's checkout away: its worktree and its branch, and everything only they
 *  hold. The one command here that loses work, so it says exactly what it is about to take
 *  and takes a second word — `--yes` — before it does.
 *
 *  Cancelling a delivery deliberately leaves its worktree where it is; this is how one is
 *  reclaimed. */
export async function cmdDiscard(named: string, opts: { yes?: boolean }): Promise<MoveResult> {
  const cost = discardCost(named)
  if (!cost) {
    // Nothing to lose, so nothing to confirm: a delivery with no worktree left is already
    // as discarded as it gets.
    const res = await discardDelivery(named)
    if (!res.ok) die(res.error ?? 'that delivery could not be discarded', { kind: 'run-refused' })
    say(`delivery ${res.deliveryId} has no worktree left — nothing to discard.`)
    return { deliveryId: res.deliveryId }
  }
  if (opts.yes !== true) {
    say(`delivery ${cost.deliveryId} would lose:`)
    say(`  ${cost.worktree} — its worktree, and anything in it that is not committed`)
    if (cost.branch) say(`  ${cost.branch} — its branch, and every commit only that branch has`)
    say('')
    say(`nothing was removed. Run it again with --yes to go ahead.`)
    return { deliveryId: cost.deliveryId, discarded: false }
  }
  const res = await discardDelivery(named)
  if (!res.ok) die(res.error ?? 'that delivery could not be discarded', { kind: 'run-refused' })
  say(`delivery ${res.deliveryId} discarded — its worktree and branch are gone.`)
  return { deliveryId: res.deliveryId, discarded: true }
}

/** End a run. Its half-finished edits are left in the working tree — the board never
 *  undoes work. */
export async function cmdStop(id: string | undefined): Promise<MoveResult> {
  const res = await stopRun(id ?? 'last')
  if (!res.ok) die(res.error ?? 'that run could not be stopped', { kind: 'run-refused' })
  say(`stopping ${short(res.sessionId!)}`)
  return { sessionId: res.sessionId }
}

// ---- reading ---------------------------------------------------------------

/** What is running, and what ran lately. */
export async function cmdRuns(opts: { card?: number; all?: boolean }, program = 'akb'): Promise<MoveResult> {
  let runs = await listRuns()
  const card = opts.card ?? null
  if (card !== null) runs = runs.filter((r) => r.cardId === card)
  const live = runs.filter((r) => r.status === 'running')
  const shown = opts.all === true ? runs : [...live, ...runs.filter((r) => r.status !== 'running').slice(-10)]
  if (!shown.length) {
    say(card !== null ? `nothing has run on #${card}` : 'nothing is running, and nothing has lately')
    return { runs: [] }
  }
  for (const r of shown) say(runLine(r, program))
  if (live.length) say('')
  say(
    live.length
      ? `${live.length} running. Follow one with \`${program} run log <id> --follow${BOARD_FLAG}\`.`
      : 'nothing running.',
  )
  return { runs: shown }
}

/** One run's log — what it is doing, or what it did. */
export async function cmdLog(
  named: string | undefined,
  opts: { full?: boolean; follow?: boolean },
  program = 'akb',
): Promise<MoveResult> {
  const id = named ?? 'last'
  const view = await getRun(id, opts.full === true ? Infinity : undefined)
  if (!view) die(`no run here answers to "${id}"`, { kind: 'no-such-run', run: id })
  if (opts.follow === true) {
    say(runLine(view, program))
    return { sessionId: view.sessionId, ...(await followRun(view.sessionId, view.tail ?? '', program)) }
  }
  say(runLine(view, program))
  say('')
  if (view.tail) say(view.tail)
  if (view.result) {
    say('')
    say(view.result)
  }
  if (view.note) {
    say('')
    say(view.note)
  }
  return {
    sessionId: view.sessionId,
    status: view.status,
    tail: view.tail,
    result: view.result,
    note: view.note,
  }
}

// Follow a run to its end, printing the log as it arrives. This is the one command that
// waits, and it is a choice the user made — the run itself is never waited on.
//
// It reads the file rather than the run's own output, so it works on any run, including
// one this machine did not start.
export async function followRun(sessionId: string, already = '', program = 'akb'): Promise<MoveResult> {
  const view = await getRun(sessionId)
  if (!view) return {}
  let seen = already.length
  // Written into the log as it goes, so a follow that started late still catches up.
  const drain = () => {
    const text = readLogTail(view.logPath, Infinity)
    if (text === null) return
    const { tail } = splitLog(text)
    if (tail.length > seen) {
      process.stdout.write(tail.slice(seen))
      seen = tail.length
    }
  }
  // Synchronous on purpose: a command that follows a run has nothing else to do, and this
  // way it prints in the order the run wrote.
  for (;;) {
    drain()
    const now = await getRun(sessionId)
    if (!now || now.status !== 'running') {
      drain()
      if (now?.result) {
        process.stdout.write('\n')
        say(now.result)
      }
      // The board's own last word, when it has one. It is written by the watcher after the
      // run closes, so a follow can outrun it by a beat — read it again rather than assume.
      const note = (await getRun(sessionId))?.note
      if (note) {
        process.stdout.write('\n')
        say(note)
      }
      say('')
      say(runLine(now ?? view, program))
      return { status: now?.status, result: now?.result, note }
    }
    sleep(FOLLOW_MS)
  }
}

// Wait without going async: every command here is synchronous, and a follow has nothing
// else to be doing.
function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

// ---- how a run reads -------------------------------------------------------

const MARK: Record<string, string> = {
  running: '·',
  done: '✓',
  error: '✗',
  interrupted: '~',
  stopped: '■',
}

function runLine(r: RunView, program = 'akb'): string {
  // A spec run says which agent it is: `spec` alone would read the same for every one of
  // them, and which agent is working is the whole of what that row has to say.
  const kind = r.specAgent ? `${r.action} ${r.specAgent}` : r.action
  const what = r.cardId !== null ? `${kind} #${r.cardId}` : kind
  const bits = [
    `${MARK[r.status] ?? '?'} ${short(r.sessionId)}`,
    what.padEnd(18),
    r.status === 'running' ? `running ${ago(Date.now() - r.startedAt)}` : r.status,
  ]
  // Which delivery this run belongs to, when it belongs to one. Without it a delivery's
  // three runs read as three unrelated attempts at the same card.
  if (r.deliveryId) bits.push(`delivery ${r.deliveryId}`)
  if (r.durationMs !== undefined) bits.push(`in ${ago(r.durationMs)}`)
  if (r.model) bits.push(r.model)
  if (r.costUsd !== undefined) bits.push(`$${r.costUsd.toFixed(4)}`)
  if (r.canResume) bits.push(`— continue it with \`${program} run resume ${short(r.sessionId)}${BOARD_FLAG}\``)
  const line = bits.join('  ')
  // The board's own last word rides on the row, not only in the log. `✓ done` beside a run
  // that left the board inconsistent reads as "nothing to see here", which is the one thing
  // it must not — and a note nobody opens the log for is a note nobody reads.
  const under = [r.input && firstLine(r.input), r.note && `! ${firstLine(r.note)}`].filter(Boolean)
  return under.length ? [line, ...under.map((s) => `    ${s}`)].join('\n') : line
}

// Eight characters of a run's id: enough to name one on a board, short enough to type
// and to read down a column. Every command that takes an id takes any prefix of one.
export const short = (sessionId: string): string => sessionId.slice(0, 8)

function firstLine(text: string): string {
  const line = text.split('\n')[0]!.trim()
  return line.length > 80 ? `${line.slice(0, 77)}…` : line
}

function ago(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

/** The watcher's own door. Not a command anyone types — it is what `spawnWatcher` starts,
 *  and it is spelled so it can never be mistaken for one. */
export async function cmdWatch(sessionId: string): Promise<number> {
  const { watchRun } = await import('../lib/agent/watch')
  // The one process alive for the whole of a run, so it is what holds the lease on a claim
  // an approval taken elsewhere left here (#318). A delivery started from a terminal has no
  // board server behind it, and a lease nobody renews reads as an interrupted delivery.
  const letGo = holdCloudClaims()
  try {
    return await watchRun(sessionId)
  } finally {
    letGo()
  }
}
