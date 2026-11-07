// The proposer (#534, #1467): what the board does with the cards it has just finished.
//
// A completed card joins the queue in the settings (`reflectQueue`), and one `reflect` run
// covers the oldest REFLECT_BATCH of it, so a follow-up several cards lead to is proposed
// once. The board's timer starts that run like any scheduled agent (view/dispatch.ts, #1475).
// Only a run that passed takes its cards off the queue (sessions.ts).
//
// Queueing is the archive's: `nextWork` scans cards still on the board and a completed card
// is exactly what it can no longer see. So a run's watcher queues here at its close, with the
// board as it stood when the run began. A card archived by hand from a terminal or the board
// UI queues none: nothing is watching that write.

import { readArchive } from '../view/archive'
import { queueReflect, reflectQueue } from './settings'
import { withStore } from './store'

/** Queue every card in `openBefore` — still on the board when the caller started watching —
 *  that is in the archive now as finished. True when one joined. */
export function queueCompleted(openBefore: Iterable<number>): boolean {
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
