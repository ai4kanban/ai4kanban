// Non-refinement runs started after another run ends. Refinement owns its state machine and
// follow-ups in `refine.ts`; spec-agent requests remain here.

import { findSpecAgent, specAgentEnabled } from '../spec-agents'
import { allCards } from '../view/read'
import type { Card } from '../view/types'
import { specAgentSwitches } from './settings'
import type { AgentRequest, SpecAsk } from './types'

/**
 * The spec agents this run asked for while it was going, as runs to start now that it has
 * ended (#187).
 *
 * A flow asks with `akb spec <agent> <id>`, which starts nothing: a run never starts
 * another, so the ask was written down (`askForSpec`) and this is where it is finally
 * spawned. By now the conversation that wanted it is over, which is the whole point — the
 * agent reads the card, not the reading of it.
 *
 * An ask for a card that is no longer there is dropped: the run that asked went on to
 * archive or reject it, and there is nothing left to write a section on. So is an ask for
 * an agent that has been switched off since (#191) — the switch is read here, as the run
 * is about to start, so the last flip is the one that counts.
 */
export function specRunsAfter(asks: SpecAsk[]): AgentRequest[] {
  if (!asks.length) return []
  const switches = specAgentSwitches()
  let cards: Card[]
  try {
    cards = allCards()
  } catch {
    return []
  }
  const byId = new Map(cards.map((c) => [c.id, c]))
  return asks.flatMap((ask) => {
    const card = byId.get(ask.cardId)
    if (!card) return []
    const agent = findSpecAgent(ask.specAgent)
    if (!agent || !specAgentEnabled(agent.name, switches)) return []
    return [{ action: 'spec' as const, id: ask.cardId, title: card.title, specAgent: agent.name, notes: ask.notes }]
  })
}
