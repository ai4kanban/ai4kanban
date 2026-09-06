// The ready gate (#440): who decides that a settled card may build itself.
//
// A refine ends with the card at `ready` and the board stops there — somebody has to press
// Implement. With the gate switched on (agent/settings.ts) one `gate` run stands in for
// that press: it reads the card against the board's own writing standard and either lets it
// through into a delivery or hands it back with the one question that stops it.
//
// Two rules shape everything here:
//
//   • It fires on ONE transition — `todo` → `ready`, the plan settling — and on no other
//     way a card can come to be resting at `ready`. That distinction is the whole of the
//     loop protection: a delivery that ends puts its card back where it found it
//     (`implementing` → `ready`, agent/sessions.ts), so a gate that fired on "is ready now,
//     wasn't before" would gate the card its own build had just handed back, build it
//     again, and never stop. So a caller takes every card's stage before it starts
//     (`cardStages`) and only a card that was at `todo` — or that did not exist yet — is
//     gated.
//   • The switch is read at the moment a run would START, not when the card moved. A gate
//     queued behind another run and a build queued behind its gate both ask again, so
//     switching the gate off stops what it had lined up.

import { allCards, findCard } from '../view/read'
import { byDispatchOrder } from '../view/rules'
import type { Card } from '../view/types'
import { activeDelivery } from './deliveries'
import { flowRefusal } from './flows'
import { readyGateOn } from './settings'
import { startRun } from './start'
import { withStore } from './store'
import { holdsCard } from './types'
import type { AgentRequest, RunRecord } from './types'

/** Every card's stage, by id. Taken before a run starts and handed back to `gateRunAfter`
 *  at its close, which is what lets the gate tell one arrival at `ready` from another. */
export type CardStages = ReadonlyMap<number, string>

export function cardStages(): CardStages {
  try {
    return new Map(allCards().map((card) => [card.id, card.status as string]))
  } catch {
    // An unreadable board. Every card then reads as one that did not exist, and the filter
    // below still needs it to be `ready` NOW — so at worst a card settled in this window is
    // gated, which is the job.
    return new Map()
  }
}

// The one move that means "the plan just settled". A card the board has not seen before
// counts: a run that wrote it and took it to `ready` in one go settled it too.
const settledDuring = (before: CardStages, id: number): boolean => (before.get(id) ?? 'todo') === 'todo'

/** Whether the board may put a gate on this card by itself. The same cards `akb guide
 *  next-card` drops — a group root, a recurring job, a card already in flight — plus the two
 *  a gate has nothing to judge: one still waiting on an answer, and one waiting on another
 *  card. Typing `akb card gate <id>` bypasses all of it, as every flow does. */
export function gateable(card: Card): boolean {
  return (
    card.status === 'ready' &&
    !card.isGroup &&
    !card.recurring &&
    card.questions.length === 0 &&
    card.openBlockers.length === 0 &&
    !activeDelivery(card.id)
  )
}

// The cards a live run is holding. A gate on one would be refused at the door anyway
// (agent/sessions.ts); asking here means the board picks the next card instead of spending
// its one gate on a refusal.
function heldByRuns(): Set<number> {
  try {
    return withStore(
      (store) =>
        new Set(
          store.runs
            .filter((r) => r.status === 'running' && holdsCard(r.action))
            .map((r) => r.cardId)
            .filter((id): id is number => id !== null),
        ),
    )
  } catch {
    return new Set()
  }
}

/** The one gate run to start now, or null. `before` is every card's stage as it stood when
 *  the caller started watching; a card at `ready` now that was at `todo` then has just
 *  settled. One card per round, in `akb guide next-card`'s order, so a run that settled six
 *  cards spends one gate and the rest are picked up as that one ends. */
export function gateRunAfter(before: CardStages): AgentRequest | null {
  if (!readyGateOn()) return null
  // A board whose solution has no gate never starts one by itself either (#435) — the
  // switch may say on, but there is nothing behind it to run.
  if (flowRefusal('gate')) return null
  let cards: Card[]
  try {
    cards = allCards()
  } catch {
    return null
  }
  const held = heldByRuns()
  const next = cards
    .filter((card) => settledDuring(before, card.id) && !held.has(card.id) && gateable(card))
    .sort(byDispatchOrder)[0]
  return next ? { action: 'gate', id: next.id, title: next.title } : null
}

/** What a gate run that FINISHED means. A gate says "build it" by changing nothing: the
 *  card is still `ready` with nothing to answer, so the build the user would have pressed
 *  for starts here. A gate that found something appended a `[user]` question, which took the
 *  card back to `todo` — and that IS the answer, so nothing starts.
 *
 *  Only ever asked of a run that ended cleanly. A gate that failed, was stopped or never
 *  spawned judged nothing, and a card must not be built on a verdict nobody reached. */
export function buildAfterGate(run: Pick<RunRecord, 'action' | 'cardId'>): AgentRequest | null {
  if (run.action !== 'gate' || run.cardId === null) return null
  if (!readyGateOn()) return null
  let card: Card | null
  try {
    card = findCard(run.cardId)
  } catch {
    return null
  }
  if (!card || !gateable(card)) return null
  return { action: 'implement', id: card.id, title: card.title }
}

/** Start the gate on a card somebody has just taken to `ready` themselves, and say which
 *  card it went to. Null when the switch is off, nothing entered `ready`, or the run would
 *  not start.
 *
 *  Best-effort by design: the move that moved the card is already done, and a gate that
 *  could not start is one `akb card gate <id>` away. */
export async function startGateAfter(
  before: CardStages,
): Promise<{ cardId: number; sessionId: string } | null> {
  const req = gateRunAfter(before)
  if (!req) return null
  try {
    const started = await startRun(req)
    return 'error' in started ? null : { cardId: req.id!, sessionId: started.run.sessionId }
  } catch {
    return null
  }
}
