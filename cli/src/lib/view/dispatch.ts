// ---- what the board should start on its own --------------------------------
//
// One job that needs no user at all: running the recurring cards whose cadence has elapsed.
// A front end with a timer asks this once a tick and starts whatever comes back — it holds
// the timer, this holds the rules, so a board driven from a window and a board driven from
// anywhere else pick the same cards in the same order.
//
// Refining is NOT here. Nothing hunts the backlog for cards to refine: a refine follows the
// run that touched the card, started by that run's own watcher (`agent/follow.ts`).
//
// Nothing here starts anything or reads a clock the caller owns. It is one look at the
// board and the runs that are live.

import { nextDue } from '../cadence'
import { listRuns } from '../agent/sessions'
import type { AgentRequest, RunView } from '../agent/types'
import { readBoard } from './read'
import { byDispatchOrder } from './rules'
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

/**
 * The runs the board would start on its own right now, in the order to start them.
 *
 * At most one: a recurring run does real work in the repo, and two at once is a merge
 * nobody asked for. The cadence written on a card is the only switch a background run has —
 * no cadence, no background run.
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

  if (runs.some((r) => r.status === 'running' && r.action === 'run')) return []
  const card = dueRecurring(cards, runs, busy)[0]
  return card ? [{ action: 'run', id: card.id, title: card.title }] : []
}
