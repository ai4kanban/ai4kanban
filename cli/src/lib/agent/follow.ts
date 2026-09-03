// The runs a finished run asked for by name. Refinement owns its own state machine in
// `refine.ts`; what lives here is the handoff — an ask written down mid-run, turned into a
// run to start now that the run that wrote it is over.

import { findSpecSkill, specSkillEnabled } from '../spec-skills'
import { allCards } from '../view/read'
import type { Card } from '../view/types'
import { refinementRequest } from './refine'
import { specAgentEntries } from './settings'
import type { AgentRequest, RefineAsk, SpecAsk } from './types'

/**
 * The spec skills this run asked for while it was going, as runs to start now that it has
 * ended (#187).
 *
 * A flow asks with `akb spec <skill> <id>`, which starts nothing: a run never starts
 * another, so the ask was written down (`askForSpec`) and this is where it is finally
 * spawned. By now the conversation that wanted it is over, which is the whole point — the
 * skill reads the card, not the reading of it.
 *
 * An ask for a card that is no longer there is dropped: the run that asked went on to
 * archive or reject it, and there is nothing left to write a section on. So is an ask for a
 * skill that has been switched off since, or that has left the board (#191, #403) — both are
 * read here, as the run is about to start, so the last change is the one that counts.
 */
export function specRunsAfter(asks: SpecAsk[]): AgentRequest[] {
  if (!asks.length) return []
  const entries = specAgentEntries()
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
    const skill = findSpecSkill(ask.specAgent)
    if (!skill || !specSkillEnabled(skill.name, entries)) return []
    return [{
      action: 'spec' as const,
      id: ask.cardId,
      title: card.title,
      specAgent: skill.name,
      notes: ask.notes,
      refineEffort: ask.refineEffort,
    }]
  })
}

/**
 * The cards a run explicitly handed to a refinement with `akb refine <id>`, as the sessions
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
