// Starting a run, and everything you do to one afterwards: watch it, list them, stop one,
// continue one that stopped short.
//
// Every one of these commands returns as soon as it has done its bit. Starting prints the
// run's id and exits — the run outlives it — so the same run can be followed, stopped or
// continued from anywhere, by anyone, including a process that never saw it start.

import { insideRun, printFlow } from '../lib/agent/flow'
import { spawnWatcher } from '../lib/agent/launch'
import { readLogTail, splitLog } from '../lib/agent/log'
import {
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
  type AgentAction,
  type AgentRequest,
  type Boldness,
  type RunView,
} from '../lib/agent/types'
import { say } from '../lib/io'
import { die } from '../lib/paths'
import type { MoveResult } from '../lib/types'
import { parseFlags } from '../lib/validate'

// How long a `--follow` waits between reads of a run's log. Short enough that the log
// reads as it happens, long enough that following a run is not a busy loop.
const FOLLOW_MS = 400

// ---- starting --------------------------------------------------------------

/** The one door every kind of run goes through: work out what was asked for, write it
 *  down, hand it to a watcher, and say which run started.
 *
 *  Or print the flow and start nothing — `--print`, and the one case the caller doesn't
 *  pick: an agent already working inside a run the board started, which never starts
 *  another (see `lib/agent/flow.ts`). */
export function cmdStartRun(action: AgentAction, args: string[], program = 'akb'): MoveResult {
  const { req, follow, print } = readRequest(action, args)
  const inside = insideRun()
  if (print || inside) {
    if (!print) say(`inside run ${short(inside!)} — a run never starts another, so here is the flow instead.`)
    return printFlow(req, program)
  }
  const started = startRun(req)
  if ('error' in started) die(started.error, { kind: 'run-refused', action })
  const { run, spawned } = started
  if (!spawned) die(`couldn't start a process to run ${run.sessionId}`, { kind: 'spawn-failed' })
  say(`${action} — run ${run.sessionId}`)
  say(`  follow it: ${program} log ${short(run.sessionId)} --follow`)
  say(`  stop it:   ${program} stop ${short(run.sessionId)}`)
  if (follow) return { sessionId: run.sessionId, ...followRun(run.sessionId) }
  return { sessionId: run.sessionId, action, cardId: run.cardId }
}

// What each action takes, and what it means. Everything past these is the action's own; a
// flag an action doesn't take is refused rather than ignored.
const SHARED = ['follow', 'dir', 'json']

// `--print` is every starting command's, and only theirs: an action that can start a run can
// instead print its steps, and there is nothing to print about stopping or reading one.
const START_SHARED = [...SHARED, 'print']

function readRequest(
  action: AgentAction,
  args: string[],
): { req: AgentRequest; follow: boolean; print: boolean } {
  const allowed = [...START_SHARED, ...FLAGS[action]]
  const { flags, positional } = parseFlags(args, allowed)
  const follow = flags.follow === true
  const print = flags.print === true
  // Nothing starts, so there is no log to watch. Refused rather than quietly dropped: one
  // of the two words was meant, and guessing which is how a background run gets lost.
  if (print && follow) die('--print starts nothing, so there is no run to --follow', { kind: 'bad-option' })
  const text = (key: string): string | undefined => {
    const value = flags[key]
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
  }

  // The four actions that name no card. Three of them name nothing at all; planning names
  // a version.
  if (action === 'create') {
    const description = positional.join(' ').trim() || text('notes')
    if (!description) die('say what to create: akb create "what you want"', { kind: 'needs-input' })
    return { req: { action, description, release: text('release') }, follow, print }
  }
  if (action === 'propose') {
    const count = flags.count === undefined ? undefined : Number(flags.count)
    if (count !== undefined && (!Number.isInteger(count) || count < 1 || count > PROPOSE_MAX)) {
      die(`--count takes a whole number from 1 to ${PROPOSE_MAX}`, { kind: 'bad-option' })
    }
    const boldness = text('boldness')
    if (boldness && !['safe', 'normal', 'bold'].includes(boldness)) {
      die('--boldness takes safe, normal or bold', { kind: 'bad-option' })
    }
    return {
      req: { action, module: text('module'), count, boldness: boldness as Boldness | undefined },
      follow,
      print,
    }
  }
  if (action === 'plan-release') {
    const release = positional[0]?.trim() || text('release')
    if (!release) die('name the version to plan: akb plan-release v1', { kind: 'needs-input' })
    return { req: { action, release }, follow, print }
  }
  // The fourth: setting the board up names nothing at all. The checklist says what is left.
  if (action === 'setup') return { req: { action }, follow, print }

  // Everything else works on one card.
  const id = Number(positional[0])
  if (!Number.isInteger(id)) die(`${action} takes a card id, e.g. \`akb ${action} 12\``, { kind: 'needs-input' })
  const req: AgentRequest = { action, id, title: titleOf(id) }
  if (action === 'reject') {
    req.reason = positional.slice(1).join(' ').trim() || text('reason')
    if (!req.reason) die('say why: akb reject 12 "the reason"', { kind: 'needs-input' })
  } else if (action === 'edit') {
    req.notes = positional.slice(1).join(' ').trim() || text('notes')
    if (!req.notes) die('say what to change: akb revise 12 "what to change"', { kind: 'needs-input' })
  } else {
    req.notes = positional.slice(1).join(' ').trim() || text('notes')
  }
  if (action === 'resolve' && flags['and-implement'] === true) req.andImplement = true
  return { req, follow, print }
}

const FLAGS: Record<AgentAction, string[]> = {
  implement: ['notes'],
  run: ['notes'],
  reject: ['reason'],
  archive: ['notes'],
  edit: ['notes'],
  create: ['notes', 'release'],
  propose: ['module', 'count', 'boldness'],
  'plan-release': ['release'],
  refine: [],
  resolve: ['notes', 'and-implement'],
  setup: [],
}

/** Send one more turn into a run that stopped short: same agent, same conversation, same
 *  card — and the prompt is just "carry on". */
export function cmdResume(args: string[]): MoveResult {
  const { flags, positional } = parseFlags(args, SHARED)
  const opened = openResume(positional[0] ?? 'last')
  if ('error' in opened) die(opened.error, { kind: 'run-refused' })
  const { run } = opened
  const pid = spawnWatcher(run.sessionId)
  markSpawned(run.sessionId, pid)
  if (!pid) die(`couldn't start a process to run ${run.sessionId}`, { kind: 'spawn-failed' })
  say(`continuing ${short(run.resumedFrom!)} — run ${run.sessionId}`)
  if (flags.follow === true) return { sessionId: run.sessionId, ...followRun(run.sessionId) }
  return { sessionId: run.sessionId, resumedFrom: run.resumedFrom }
}

/** End a run. Its half-finished edits are left in the working tree — the board never
 *  undoes work. */
export function cmdStop(args: string[]): MoveResult {
  const { positional } = parseFlags(args, SHARED)
  const res = stopRun(positional[0] ?? 'last')
  if (!res.ok) die(res.error ?? 'that run could not be stopped', { kind: 'run-refused' })
  say(`stopping ${short(res.sessionId!)}`)
  return { sessionId: res.sessionId }
}

// ---- reading ---------------------------------------------------------------

/** What is running, and what ran lately. */
export function cmdRuns(args: string[]): MoveResult {
  const { flags } = parseFlags(args, [...SHARED, 'card', 'all'])
  let runs = listRuns()
  const card = flags.card === undefined ? null : Number(flags.card)
  if (card !== null) {
    if (!Number.isInteger(card)) die('--card takes a card id', { kind: 'bad-option' })
    runs = runs.filter((r) => r.cardId === card)
  }
  const live = runs.filter((r) => r.status === 'running')
  const shown = flags.all === true ? runs : [...live, ...runs.filter((r) => r.status !== 'running').slice(-10)]
  if (!shown.length) {
    say(card !== null ? `nothing has run on #${card}` : 'nothing is running, and nothing has lately')
    return { runs: [] }
  }
  for (const r of shown) say(runLine(r))
  if (live.length) say('')
  say(
    live.length
      ? `${live.length} running. Follow one with \`akb log <id> --follow\`.`
      : 'nothing running.',
  )
  return { runs: shown }
}

/** One run's log — what it is doing, or what it did. */
export function cmdLog(args: string[]): MoveResult {
  const { flags, positional } = parseFlags(args, [...SHARED, 'full'])
  const id = positional[0] ?? 'last'
  const view = getRun(id, flags.full === true ? Infinity : undefined)
  if (!view) die(`no run here answers to "${id}"`, { kind: 'no-such-run', run: id })
  if (flags.follow === true) {
    say(runLine(view))
    return { sessionId: view.sessionId, ...followRun(view.sessionId, view.tail ?? '') }
  }
  say(runLine(view))
  say('')
  if (view.tail) say(view.tail)
  if (view.result) {
    say('')
    say(view.result)
  }
  return {
    sessionId: view.sessionId,
    status: view.status,
    tail: view.tail,
    result: view.result,
  }
}

// Follow a run to its end, printing the log as it arrives. This is the one command that
// waits, and it is a choice the user made — the run itself is never waited on.
//
// It reads the file rather than the run's own output, so it works on any run, including
// one this machine did not start.
function followRun(sessionId: string, already = ''): MoveResult {
  const view = getRun(sessionId)
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
    const now = getRun(sessionId)
    if (!now || now.status !== 'running') {
      drain()
      if (now?.result) {
        process.stdout.write('\n')
        say(now.result)
      }
      say('')
      say(runLine(now ?? view))
      return { status: now?.status, result: now?.result }
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

function runLine(r: RunView): string {
  const what = r.cardId !== null ? `${r.action} #${r.cardId}` : r.action
  const bits = [
    `${MARK[r.status] ?? '?'} ${short(r.sessionId)}`,
    what.padEnd(18),
    r.status === 'running' ? `running ${ago(Date.now() - r.startedAt)}` : r.status,
  ]
  if (r.durationMs !== undefined) bits.push(`in ${ago(r.durationMs)}`)
  if (r.model) bits.push(r.model)
  if (r.costUsd !== undefined) bits.push(`$${r.costUsd.toFixed(4)}`)
  if (r.canResume) bits.push('— continue it with `akb resume ' + short(r.sessionId) + '`')
  const line = bits.join('  ')
  return r.input ? `${line}\n    ${firstLine(r.input)}` : line
}

// Eight characters of a run's id: enough to name one run on a board, short enough to type
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
export async function cmdWatch(args: string[]): Promise<number> {
  const sessionId = args[0]
  if (!sessionId) return 1
  const { watchRun } = await import('../lib/agent/watch')
  return watchRun(sessionId)
}
