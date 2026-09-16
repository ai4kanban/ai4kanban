// The runs a finished run asked for by name. Refinement owns its own state machine in
// `refine.ts`; what lives here is the handoff — an ask written down mid-run, turned into a
// run to start now that the run that wrote it is over.

import { findSpecAgent, specAgentAssigned } from '../agents'
import { allCards } from '../view/read'
import type { Card } from '../view/types'
import { dependencyRefusal } from './dependencies'
import { refinementRequest } from './refine'
import { cardWorkflowId } from './workflows'
import type { AgentRequest, RefineAsk, SpecAsk } from './types'

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
 * archive or reject it, and there is nothing left to write a section on. So is an ask for an
 * agent its card's workflow no longer assigns, or that has left the board (#403, #749) —
 * both are read here, as the run is about to start, so the last change is the one that
 * counts.
 */
export function specRunsAfter(asks: SpecAsk[]): AgentRequest[] {
  if (!asks.length) return []
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
    if (!agent || !specAgentAssigned(agent.name, cardWorkflowId(ask.cardId))) return []
    return [{
      action: 'spec' as const,
      id: ask.cardId,
      title: card.title,
      specAgent: agent.name,
      notes: ask.notes,
      refineEffort: ask.refineEffort,
    }]
  })
}

/** Where a round of helpers starts (#782): the first one whose dependencies are ready, and
 *  why each one before it was refused. `self` is the run that asked, closing now. */
export function helperRound(helpers: AgentRequest[], self?: string): { start: AgentRequest[]; refused: string[] } {
  const refused: string[] = []
  for (let i = 0; i < helpers.length; i++) {
    const req = helpers[i]!
    const queued = helpers.slice(i + 1).filter((h) => h.id === req.id).map((h) => h.specAgent ?? '')
    const blocked = dependencyRefusal(req.id as number, req.specAgent ?? '', { queued, self })
    if (!blocked) return { start: helpers.slice(i), refused }
    refused.push(blocked)
  }
  return { start: [], refused }
}

/**
 * The cards a run explicitly handed to a refinement with `akb card refine <id>`, as the sessions
 * to start now that it has ended.
 *
 * The card is read here, as the session is about to start, so an ask for a card that has
 * gone — or that a refinement would no longer move — is dropped rather than started.
 */
export function refineRunsAfter(asks: RefineAsk[]): AgentRequest[] {
  return asks.flatMap((ask) => {
    const next = refinementRequest({
      action: 'refine',
      id: ask.cardId,
      notes: ask.notes,
      refineEffort: ask.effort,
    })
    return 'error' in next ? [] : [next]
  })
}
