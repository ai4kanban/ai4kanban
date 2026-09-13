// Whether a stage has produced everything its contract requires (#714).
//
// A contract's `requires` names the helpers the stage cannot end without (./stages.ts). The
// lead is required too and is never listed — it is the run that just closed. Every helper's
// output is a section on the card, so "did it produce anything" is a question the card
// itself answers.
//
// Nothing the command ships requires a helper, so on both solutions this reads as done on
// the first line and the two boards finish exactly when they finished before. It starts
// mattering when a board can write its own contracts (#716).

import { findSpecAgent, specAgentEnabled, specHeading } from '../agents'
import type { Card } from '../view/types'
import { flowByAction } from './flows'
import { readStore } from './store'
import { stageOfFlow, type Stage, type StageContract } from './stages'
import type { AgentAction, AgentRequest, RefineEffort } from './types'

/** A stage that cannot end: the helpers it requires that have written nothing, and that
 *  asking again would not fix. */
export interface StageShort {
  stage: Stage
  missing: string[]
}

/** Where a stage stands at the close of one of its runs. */
export type StageEnd =
  /** Everything the contract requires is on the card. */
  | { done: true }
  /** One required helper has never been asked for on this card — ask for it, then look
   *  again. At most one per capability per card: a second ask that came back with nothing
   *  would come back with nothing again. */
  | { ask: AgentRequest }
  | StageShort

/** The helpers a stage requires that have written nothing on this card. */
export const missingRequired = (contract: StageContract, card: Card): string[] =>
  contract.requires.filter((name) => !card.body.includes(specHeading(name)))

/** Where the stage stands, and what would move it on. `card` is the card as it is now. */
export function endOfStage(contract: StageContract, card: Card, refineEffort?: RefineEffort): StageEnd {
  const missing = missingRequired(contract, card)
  if (!missing.length) return { done: true }
  const askable = missing.find(
    (name) => findSpecAgent(name) && specAgentEnabled(name) && !askedFor(card.id, name),
  )
  if (!askable) return { stage: contract.stage, missing }
  return {
    ask: {
      action: 'spec',
      id: card.id,
      title: card.title,
      specAgent: askable,
      ...(refineEffort ? { refineEffort } : {}),
    },
  }
}

/** One plain line for a stage that stopped short — what is missing, and what to do about
 *  it. The card is where the user acts, so the line names it. */
export const shortLine = (short: StageShort, cardId: number): string =>
  `the ${short.stage} stage of #${cardId} is not finished: ` +
  `${short.missing.map((name) => `\`${name}\``).join(', ')} ` +
  `${short.missing.length === 1 ? 'is' : 'are'} required here and wrote nothing. ` +
  `Run ${short.missing.length === 1 ? 'it' : 'them'} yourself, take the requirement off the stage, ` +
  'or write that part of the card by hand.'

/** The stage a closing run belonged to, or undefined when it ran a shared node or nothing
 *  a contract claims. A spec agent is the planning stage's helper, whichever flow asked. */
export const stageOfAction = (action: AgentAction): Stage | undefined => {
  if (action === 'spec') return 'plan'
  const flow = flowByAction(action)
  return flow ? stageOfFlow(flow.command) : undefined
}

// Has this capability already been asked for on this card? The record is the run list
// itself — a spec run names the card it was for and the agent it was. That list is the last
// hundred runs on this board, which is far more than the one planning loop between the ask
// and the look, so nothing keeps a second record for this.
const askedFor = (cardId: number, agent: string): boolean =>
  readStore().runs.some((run) => run.action === 'spec' && run.cardId === cardId && run.specAgent === agent)
