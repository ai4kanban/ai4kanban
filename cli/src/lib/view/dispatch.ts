// ---- what the board should start on its own --------------------------------
//
// Two jobs that need no user at all: the cards somebody scheduled, whose last blocker has
// now left the board, and the recurring cards whose cadence has elapsed. A front end with a
// timer asks this once a tick and starts whatever comes back — it holds the timer, this
// holds the rules, so a board driven from a window and a board driven from anywhere else
// pick the same cards in the same order.
//
// Refining is NOT here. Nothing hunts the backlog for cards to refine: a refine follows the
// run that touched the card, started by that run's own watcher (`agent/follow.ts`). A
// scheduled run therefore never queues behind one — the two are started by different things
// entirely, and a refine in flight can't hold back a card whose blocker just cleared.
//
// Nothing here reads a clock the caller owns, and only one thing here writes: taking the
// mark off a scheduled card, which has to happen in the same pass that hands its run back.
// See `dueScheduled`.

import { nextDue } from '../cadence'
import { withBoardLock } from '../lock'
import { advanceLanding } from '../agent/landing'
import { listRuns } from '../agent/sessions'
import type { AgentRequest, RunView } from '../agent/types'
import { setCardSchedule } from './edit'
import { readBoard } from './read'
import { byDispatchOrder, scheduleWouldDoNothing } from './rules'
import type { Card } from './types'

// The newest `run` on each card. Only run records count here: this asks "has a pass already
// been started for the window the card is due in", and an edit or a refine on the same card
// says nothing about that.
function newestRuns(runs: RunView[]): Map<number, RunView> {
  const newest = new Map<number, RunView>()
  for (const r of runs) {
    if (r.cardId === null || r.action !== 'run') continue
    const best = newest.get(r.cardId)
    if (!best || r.startedAt > best.startedAt) newest.set(r.cardId, r)
  }
  return newest
}

// The recurring cards that should run right now, highest priority first.
//
// Due is the cadence's own rule (../cadence.ts): a card that never ran is due at once,
// otherwise the interval since `last_run` has to have passed.
//
// A card is passed over when a run for this very window has already been started — the
// newest run on it began at or after the time it is due. That run stopped, failed, or was
// cut off, because only a run that PASSES is recorded, and recording moves `last_run`
// forward and with it the due time. Without this rule a broken connector — every run
// failing in seconds — would leave the card due on every tick and spawn a run a minute,
// forever. Starting it again is then a person's call.
function dueRecurring(cards: Card[], runs: RunView[], busy: Set<number>): Card[] {
  const newest = newestRuns(runs)
  const now = Date.now()
  return cards
    .filter((card) => {
      if (!card.recurring || busy.has(card.id)) return false
      const due = nextDue(card.last_run, card.cadence)
      if (!due || due.getTime() > now) return false
      const last = newest.get(card.id)
      return !last || last.startedAt < due.getTime()
    })
    .sort(byDispatchOrder)
}

// The action a scheduled card runs, as a request. A card's schedule is written in the same
// words a run is started by, so it carries straight over. The notes typed when it was
// scheduled ride along and reach the agent.
const scheduledRequest = (card: Card): AgentRequest => ({
  action: card.schedule!.action,
  id: card.id,
  title: card.title,
  notes: card.schedule!.notes || undefined,
})

/**
 * The one scheduled run to start right now, and the mark taken off every card this pass
 * settles. Null when nothing is waiting.
 *
 * A card is ready when nothing it waits on is open any more — archived and rejected count
 * the same, since either way that card is off the board and holds nothing up. At most one
 * starts per tick, in the board's own order, and the rest keep their mark for the next one:
 * a scheduled run does real work in the repo, and several at once is a merge nobody asked
 * for.
 *
 * The mark comes OFF here, in the same pass that hands the run back. That is deliberate:
 * this is the only moment the board can be sure of starting it exactly once. Leaving it on
 * until the run had begun would fire the card again next tick whenever a start was refused
 * — and a run that fails or is stopped is not meant to fire again. The card is plain again
 * and the user starts it by hand.
 *
 * A schedule whose action would no longer do anything — a refine on a card someone already
 * took to `ready` — is dropped in the same pass rather than started, and dropping one is not
 * a start, so it never uses up the tick.
 */
function dueScheduled(cards: Card[], busy: Set<number>): AgentRequest | null {
  const ready = cards.filter((c) => c.schedule && !busy.has(c.id) && c.openBlockers.length === 0)
  if (ready.length === 0) return null
  return withBoardLock(() => {
    let request: AgentRequest | null = null
    for (const card of ready.sort(byDispatchOrder)) {
      const stale = scheduleWouldDoNothing(card)
      // One start per tick. Everything after it keeps its mark — except a stale one, which
      // is dropped whenever we meet it, since no later tick would do anything else with it.
      if (!stale && request) continue
      try {
        setCardSchedule(card.id, null)
      } catch {
        // The card moved or went away between the read and this write — leave it be.
        continue
      }
      if (!stale) request = scheduledRequest(card)
    }
    return request
  })
}

/**
 * The runs the board would start on its own right now, in the order to start them.
 *
 * At most one of each kind, and the two have their own slots: a scheduled card is a run the
 * user already asked for, on a card whose turn has finally come, so it must not sit behind a
 * recurring pass that happens to be due in the same minute.
 *
 * An empty list means there is nothing to do. It never throws — a caller on a timer must
 * survive an unreadable board and try again next tick.
 */
export function nextWork(): AgentRequest[] {
  let runs: RunView[]
  let cards: Card[]
  try {
    runs = listRuns()
    cards = readBoard().columns.flatMap((c) => c.cards)
  } catch {
    return []
  }
  // A card already in a live run is skipped — opening a second run on it would be refused
  // anyway — so we move on to the next candidate.
  const busy = new Set<number>()
  for (const r of runs) if (r.status === 'running' && r.cardId !== null) busy.add(r.cardId)

  const work: AgentRequest[] = []
  let scheduled: AgentRequest | null = null
  try {
    scheduled = dueScheduled(cards, busy)
  } catch {
    // The board was busy being written, or a card wouldn't take the write. Every card keeps
    // its mark, and the next tick tries again.
  }
  if (scheduled) {
    work.push(scheduled)
    if (scheduled.id !== undefined) busy.add(scheduled.id)
  }

  if (!runs.some((r) => r.status === 'running' && r.action === 'run')) {
    const card = dueRecurring(cards, runs, busy)[0]
    if (card) work.push({ action: 'run', id: card.id, title: card.title })
  }

  // And the landing queue (#304). A landing is normally moved on by the watcher of the
  // run that just passed review; this is what picks up a waiter nothing handed off to,
  // because that process died between the two. `advanceLanding` does the git work itself
  // and hands back only the run it wants started, which is why it isn't gated on the
  // slots above: a re-review inside a landing is that delivery's own next run.
  const landing = advanceLanding()
  if (landing) work.push(landing)
  return work
}
