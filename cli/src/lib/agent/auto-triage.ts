// Sorting triage as a run (#562, #1263).
//
// A sort is the command's own loop (../signals/judge.ts) — no agent is spawned — under a run
// record, which is what draws "sorting" on the page and keeps a second sort from starting.
// `akb triage run` does it in the terminal; the board starts the same thing in the background
// once for each batch of new items, and again at a sort's close for whatever arrived meanwhile.
//
// WRITING is the trigger, and the only one: `akb triage fetch`, **Add to triage** on the page
// and `akb triage add` each start a sort after they have written. Nothing polls or retries.
//
// A sort starts the next one only when it JUDGED something: one item nothing can judge would
// otherwise start a sort forever. So the close compares the items this sort was GIVEN against
// the ones still waiting, and stops where none of them moved.

import { randomUUID } from 'node:crypto'
import fs from 'node:fs'

import { takeRunCard } from '../board'
import { SESSIONS_DIR } from '../paths'
import { reconcileTriage } from '../signals/carded'
import { readInbox } from '../signals/inbox'
import { sortable, sortItems, type SortReport } from '../signals/judge'
import { migrateTriage } from '../signals/migrate'
import { signalsAccess } from '../signals/access'
import { closeRun, markSpawned, openRun, peekRun } from './sessions'
import { startRun } from './start'
import { itemsBeingCarded } from './store'
import type { AgentRequest, RunRecord, RunRefusal } from './types'

/** Whether the board may start a sort by itself right now — read as a run would start, so
 *  Cloud going quiet stops a sort already lined up. Unreachable reads as closed, the same
 *  answer the Triage row and a fetch take. */
async function mayStart(): Promise<boolean> {
  try {
    return (await signalsAccess()).open
  } catch {
    return false
  }
}

// A sort of its own group, never the caller's: what started it is a write, not a flow, so
// hanging its cost and its notification off the run that happened to be writing would put a
// fetch's bill on the pull card.
const SORT: AgentRequest = { action: 'triage' }

/** The items waiting to be judged, by source id — never one Jev held for the user or one
 *  the user restored (#1221). What a sort is given at its spawn, and what
 *  its close is measured against. */
export function triageWaiting(): string[] {
  try {
    migrateTriage()
    const carding = itemsBeingCarded()
    return readInbox()
      .filter((item) => sortable(item) && !carding.has(item.sourceId))
      .map((item) => item.sourceId)
  } catch {
    return []
  }
}

/** Write a sort down as this process's own, for `akb triage run` in a terminal. */
export async function openSort(): Promise<{ run: RunRecord } | RunRefusal> {
  const sessionId = randomUUID()
  const held = await takeRunCard(sessionId, null)
  if (!held.ok) return held
  const opened = openRun(SORT, '', [], sessionId)
  if ('error' in opened) return opened
  markSpawned(sessionId, process.pid)
  return { run: opened.run }
}

/** Do the sort a run record stands for: reconcile, judge what is waiting one item at a time,
 *  close the record, and start the next sort for what arrived meanwhile. Null when the run is
 *  gone or already over. */
export async function runSort(sessionId: string, say: (line: string) => void = () => {}): Promise<SortReport | null> {
  const record = peekRun(sessionId)
  if (!record || record.status !== 'running') return null
  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  const said = (line: string): void => {
    try {
      fs.appendFileSync(record.logPath, `${line}\n`)
    } catch {
      // a log that cannot be written costs the run its log and nothing else
    }
    say(line)
  }
  let asked = false
  const stop = (): void => void (asked = true)
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
  const stopped = (): boolean => asked || peekRun(sessionId)?.stopping === true

  let report: SortReport | null = null
  let error: string | undefined
  let given: string[] = []
  try {
    for (const item of reconcileTriage()) said(`${item.sourceId} is already on #${item.cardId} — archived: ${item.relPath}`)
    given = triageWaiting()
    report = await sortItems(given, said, stopped)
    // Nothing landed and something failed: the sort itself did not work.
    if (report.failed.length && !report.cards.length && !report.ignored.length && !report.held.length) error = report.failed[0]!.why
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
    said(error)
  } finally {
    process.off('SIGTERM', stop)
    process.off('SIGINT', stop)
  }
  const status = stopped() ? 'stopped' : error ? 'error' : 'done'
  await closeRun(sessionId, { status, ok: status === 'stopped' ? undefined : status === 'done', code: status === 'stopped' ? null : 0, error })
  const next = status === 'done' ? await triageRunAfter(given) : null
  if (next) {
    try {
      await startRun(next)
    } catch {
      // a spawn that wouldn't — the items are waiting either way
    }
  }
  return report
}

/** Start a sort over a batch just written, if the board may and there was a batch.
 *
 *  Best-effort in both directions: `added` at zero is a pull that brought nothing new, and a
 *  run that will not start — the switch is off, triage is closed, a sort is already going —
 *  leaves the items waiting for the next batch or for a hand-typed run. Either way the
 *  write that called this succeeded, and this never reports otherwise. */
export async function triageAfterAdding(added: number): Promise<void> {
  if (added <= 0) return
  if (!(await mayStart())) return
  try {
    await startRun(SORT)
  } catch {
    // a spawn that wouldn't — the items are waiting either way
  }
}

/** The sort to start now that one has finished, or null.
 *
 *  `given` is what was waiting when that sort started. */
export async function triageRunAfter(given: string[]): Promise<AgentRequest | null> {
  if (!(await mayStart())) return null
  try {
    reconcileTriage()
    const waiting = new Set(triageWaiting())
    if (waiting.size === 0) return null
    // Nothing this sort was handed has moved, so another over the same list would do the
    // same nothing. It stops here and waits for the next batch.
    if (given.length > 0 && given.every((sourceId) => waiting.has(sourceId))) return null
    return SORT
  } catch {
    return null
  }
}
