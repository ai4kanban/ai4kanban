// Apply agent reports on the host and acknowledge completed plan saves.

import fs from 'node:fs'
import path from 'node:path'
import type { ChatTarget } from './types'
import { savePlan } from './save-plan'
import { setCardStatusOn } from '../board'
import { setChatPlan } from './chat'
import { adoptDirectCard } from './deliveries'
import { takeReports, outboxDir } from './outbox'
import { recordCreatedCards } from './store'

/** Collect reports; plan acknowledgements carry persistence failures back to the agent. */
export async function collectReports(sessionId: string, target?: ChatTarget): Promise<void> {
  for (const entry of takeReports(sessionId)) {
    try {
      if (entry.kind === 'cards') await takeCards(sessionId, entry.ids)
      else {
        const discussion = target === undefined ? entry.target : target
        let error: string | undefined
        try {
          if (entry.text !== undefined) savePlan(discussion, entry.path, entry.text, entry.title)
          else {
            const result = setChatPlan(discussion, entry.path, entry.title)
            if ('error' in result) throw new Error(result.error)
          }
        } catch (err) { error = String(err) }
        if (entry.request) {
          const ack = path.join(outboxDir(sessionId), `${entry.request}.ack`)
          fs.writeFileSync(`${ack}.tmp`, JSON.stringify({ error }))
          fs.renameSync(`${ack}.tmp`, ack)
        }
      }
    } catch {
      // Without an acknowledgement, the saving command reports an unconfirmed result.
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
