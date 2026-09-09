// The proposer (#534): what the board does with a card it has just finished.
//
// Nothing used to look back at completed work. A follow-up surfaced only when a builder or
// a planner noticed one mid-task, and the board's own way of finding new work
// (`extract-ideas`) reads outside sources and never its own history.
//
// One rule shapes everything here: ARCHIVING is the trigger, and the only one. A card
// reaching `.archive/` starts one `reflect` run over that card alone, so a follow-up is as
// fresh as it can be. Nothing sweeps cards completed earlier, and no command asks for one.
//
// The handover is the archive's, not the dispatcher's: `nextWork` scans cards still on the
// board (view/dispatch.ts) and a completed card is exactly what it can no longer see. So a
// run's watcher asks here at its close, the way it asks the landing queue what to start
// next, with the board as it stood when the run began. That covers every way a card
// completes on its own — the `archive` flow, the landing that finishes a delivery, a group
// closed by either. A card archived by hand from a terminal or the board UI starts none:
// nothing is watching that write, and somebody is standing there anyway.

import { readArchive } from '../view/archive'
import { proposerOn } from './settings'
import { startRun } from './start'
import { withStore } from './store'
import type { AgentRequest } from './types'

/** The reflect runs to start now, one per card that reached the archive while this run was
 *  up. `openBefore` is every card that was still on the board when the caller started
 *  watching; a card that was there then and is in the archive now has just completed.
 *
 *  Empty when the proposer is switched off — read here, as the runs would start, so
 *  switching it off stops what an archiving run had lined up.
 *
 *  A card that already has a reflect run is skipped. Two runs' windows overlap all the
 *  time, and both would otherwise see the same completion and reflect on it twice. */
export function reflectRunsAfter(openBefore: Iterable<number>): AgentRequest[] {
  if (!proposerOn()) return []
  const before = new Set(openBefore)
  if (!before.size) return []
  let done: { id: number; title: string }[]
  try {
    done = readArchive().cards.filter((card) => before.has(card.id))
  } catch {
    return []
  }
  if (!done.length) return []
  const already = reflectedOn()
  return done
    .filter((card) => !already.has(card.id))
    .map((card) => ({ action: 'reflect' as const, id: card.id, title: card.title }))
}

// The cards some run has already reflected on, whatever it ended as. A reflection is one
// per completion: a run that failed is not a reason to spend a second one, and the card is
// in the archive for good, so nothing about it will read differently next time.
function reflectedOn(): Set<number> {
  try {
    return withStore(
      (store) =>
        new Set(
          store.runs
            .filter((r) => r.action === 'reflect')
            .map((r) => r.cardId)
            .filter((id): id is number => id !== null),
        ),
    )
  } catch {
    return new Set()
  }
}

/** The reflection a completion with no run behind it has to start for itself. A manual
 *  delivery is finished by the user's own commit, and its card is archived where that is
 *  noticed (`settleManualCommit`) rather than at a run's close — so nothing would ever hand
 *  its reflection over. Best-effort, like the archive it follows: the card is off the board
 *  either way. */
export async function reflectOnCompletion(cardId: number): Promise<void> {
  const [req] = reflectRunsAfter([cardId])
  if (!req) return
  try {
    await startRun(req)
  } catch {
    // a spawn that wouldn't — the card is completed either way
  }
}
