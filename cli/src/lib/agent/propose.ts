// The proposer (#534, #1467): what the board does with the cards it has just finished.
//
// ARCHIVING is the trigger, and the only one. A completed card joins the queue in the
// settings (`reflectQueue`), and one `reflect` run covers the oldest REFLECT_BATCH of it, so
// a follow-up several cards lead to is proposed once. Only a run that passed takes its cards
// off the queue (sessions.ts); a failed one leaves them for the next completion.
//
// The handover is the archive's, not the dispatcher's: `nextWork` scans cards still on the
// board (view/dispatch.ts) and a completed card is exactly what it can no longer see. So a
// run's watcher asks here at its close, with the board as it stood when the run began. A card
// archived by hand from a terminal or the board UI queues none: nothing is watching that write.

import { readArchive } from '../view/archive'
import { dropReflected, queueReflect, reflectQueue } from './settings'
import { startRun } from './start'
import { withStore } from './store'
import type { AgentRequest } from './types'

/** The most cards one reflection reads. */
export const REFLECT_BATCH = 10

/** The reflection to start now, if any. `openBefore` is every card that was still on the
 *  board when the caller started watching; one that is in the archive now has just completed
 *  and joins the queue. A round starts only on a fresh completion, or when `reflected` — the
 *  run closing is a reflection that passed and the queue may still hold more. */
export function reflectRunsAfter(openBefore: Iterable<number>, reflected = false): AgentRequest[] {
  const queued = queueCompleted(openBefore)
  if (!queued && !reflected) return []
  const next = nextReflection()
  return next ? [next] : []
}

function queueCompleted(openBefore: Iterable<number>): boolean {
  const before = new Set(openBefore)
  if (!before.size) return false
  let done: number[]
  try {
    // A rejected card is filed in the archive too, and there is nothing shipped to reflect on.
    done = readArchive().cards.filter((card) => before.has(card.id) && !card.rejected).map((card) => card.id)
  } catch {
    return false
  }
  const queue = reflectQueue()
  const covered = reflectedOn()
  // The archive lists newest first; the queue is oldest first.
  const fresh = done.filter((id) => !queue.includes(id) && !covered.has(id)).reverse()
  if (!fresh.length) return false
  queueReflect(fresh)
  return true
}

// The cards some reflection already covered, whatever it ended as: two runs' windows overlap,
// and both see the same completion. A failed one's cards are still queued. A card reflected on
// alone before the queue existed is never queued again.
function reflectedOn(): Set<number> {
  try {
    return withStore((store) => {
      const ids = new Set<number>()
      for (const r of store.runs) {
        if (r.action !== 'reflect') continue
        if (r.cardId !== null) ids.add(r.cardId)
        for (const id of r.cards ?? []) ids.add(id)
      }
      return ids
    })
  } catch {
    return new Set()
  }
}

// One round over the oldest queued cards, unless a reflection is already running. A queued
// card no longer in the archive as finished is dropped.
function nextReflection(): AgentRequest | null {
  try {
    if (withStore((store) => store.runs.some((r) => r.action === 'reflect' && r.status === 'running'))) return null
    const finished = new Set(readArchive().cards.filter((card) => !card.rejected).map((card) => card.id))
    const queue = reflectQueue()
    const gone = queue.filter((id) => !finished.has(id))
    if (gone.length) dropReflected(gone)
    const cards = queue.filter((id) => finished.has(id)).slice(0, REFLECT_BATCH)
    return cards.length ? { action: 'reflect', cards } : null
  } catch {
    return null
  }
}

/** The reflection a completion with no run behind it has to start for itself. A manual
 *  delivery is finished by the user's own commit, and its card is archived where that is
 *  noticed (`settleManualCommit`) rather than at a run's close — so nothing would ever hand
 *  its reflection over. Best-effort, like the archive it follows. */
export async function reflectOnCompletion(cardId: number): Promise<void> {
  const [req] = reflectRunsAfter([cardId])
  if (!req) return
  try {
    await startRun(req)
  } catch {
    // a spawn that wouldn't — the card is completed either way
  }
}
