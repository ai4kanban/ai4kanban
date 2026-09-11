// Auto triage (#562): when the board judges what is waiting without being asked.
//
// `akb triage run` is typed by hand, so items sit in `triage/` until somebody remembers
// them. With the triager's switch on, the board starts that same run itself — once for each
// batch of new items, and again at a sort's close for whatever the sort could not see.
//
// Two rules shape all of it:
//
// WRITING is the trigger, and the only one. The three ways in — `akb triage fetch`, **Add
// to triage** on the page, `akb triage add` — each start a sort after they have written,
// the way a manual completion starts its own reflection (./propose.ts). Nothing polls,
// nothing retries, and switching the key on does not sweep what is already waiting: a
// board does not spend a backlog's worth of runs because of one setting change.
//
// And a sort starts the next one only when it JUDGED something. A run reads the list once,
// at its spawn, so anything that arrived while it went is unseen — that is what the
// continuation is for. But "something is left" as the condition is a loop: one item no flow
// can judge would start a sort forever. So the close compares the items this run was GIVEN
// against the ones still waiting, and stops where none of them moved.

import { reconcileTriage } from '../signals/carded'
import { readInbox } from '../signals/inbox'
import { migrateTriage } from '../signals/migrate'
import { signalsAccess } from '../signals/access'
import { autoTriageOn } from './settings'
import { startRun } from './start'
import type { AgentRequest } from './types'

/** Whether the board may start a sort by itself right now. Read at the moment a run would
 *  start, never earlier: switching the key off, or Cloud going quiet, stops the sort a
 *  write or a close had lined up. Cloud that cannot be reached reads as closed — the same
 *  answer the Triage row and a fetch take. */
async function mayStart(): Promise<boolean> {
  if (!autoTriageOn()) return false
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

/** The items waiting to be judged, by source id. What a sort is given at its spawn, and what
 *  its close is measured against. */
export function triageWaiting(): string[] {
  try {
    migrateTriage()
    return readInbox().map((item) => item.sourceId)
  } catch {
    return []
  }
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
 *  `given` is what was waiting when that sort spawned. Reconciling first is what a
 *  hand-typed `akb triage run` does before it starts: an item the sort carded but died
 *  before recording is archived here rather than judged twice. */
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
