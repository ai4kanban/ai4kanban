// Applying what a run reported (#622).
//
// The run leaves its reports in the project (agent/outbox.ts); this is the other end, run by
// the process watching it. Everything here is a write the RUN would have made if it could
// reach the machine folder, so it is made on the run's behalf and in the run's name.
//
// Collected while the run goes and once more as it ends, so the board shows a card the
// moment it is written rather than only when the run is over.

import { setCardStatusOn } from '../board'
import { setChatPlan } from './chat'
import { adoptDirectCard } from './deliveries'
import { takeReports } from './outbox'
import { recordCreatedCards } from './store'

/** Apply everything one run has reported since the last collection. Best-effort throughout:
 *  a report that cannot be applied is one piece of bookkeeping missing, and failing the run
 *  over it would throw away the work the report is about. */
export async function collectReports(sessionId: string): Promise<void> {
  for (const entry of takeReports(sessionId)) {
    try {
      if (entry.kind === 'cards') await takeCards(sessionId, entry.ids)
      else setChatPlan(entry.target, entry.path, entry.title)
    } catch {
      // The card is written and the plan file is on disk either way.
    }
  }
}

// The cards one `akb raw create` inside the run wrote. They go onto the run's record, and
// the first of them to a **Build now** delivery that is still waiting for a card (#470) —
// `adoptDirectCard` takes only such a run, so every other run stops at the record.
async function takeCards(sessionId: string, ids: number[]): Promise<void> {
  recordCreatedCards(sessionId, ids)
  const id = ids[0]
  if (id === undefined || !adoptDirectCard(sessionId, id)) return
  try {
    await setCardStatusOn(id, 'implementing')
  } catch {
    // the board would not take the write — the delivery holds the card either way
  }
}
