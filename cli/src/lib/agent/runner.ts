// Which agent runs one run (#443).
//
// Every run belongs to exactly one agent: a flow is run by the role that owns it
// (./roles.ts), and a `spec` or `write` run by the specialist it names. That agent is what
// picks the harness the run spawns (./resolve.ts) and how its prompt calls the skill
// (./prompts.ts).
//
// Only a flow is named, never a pass: a refine's `clarify`, `resolve` and `writing` passes
// belong to the flow that spawned them, and so to the same agent.

import { flowByAction } from './flows'
import { agentImageView } from './resolve'
import { roleForFlow } from './roles'
import { REFINE_ACTIONS, SPECIALIST_ACTIONS } from './types'
import type { AgentAction, CreateImageAgents } from './types'

/** What a run has to say about itself for its agent to be worked out. The same three fields
 *  `agent/rules.ts` reads to hand a run its rule, and read the same way. */
export interface RunAsk {
  action?: AgentAction
  /** The agent's name on a `spec` or `write` run, and nothing on any other. */
  specAgent?: string
  /** Set on a pass a refine spawned, absent on a flow a user typed — the one thing that
   *  tells a refine's `resolve` pass from an `akb card resolve` of its own. */
  refineRound?: number
}

/** The agent one run is done by: a role's name, a specialist's own name, or nothing when the
 *  request names no action — then the board's default harness runs it. */
export function agentForRun(ask: RunAsk = {}): string | undefined {
  const { action, specAgent } = ask
  if (!action) return undefined
  // A specialist runs as itself, whichever hook it is on.
  if (SPECIALIST_ACTIONS.has(action)) return specAgent
  return roleForFlow(flowOf(ask, action))?.name
}

// The flow this run belongs to. A pass belongs to the flow that spawned it, never to a flow
// of its own name: `resolve` is both a pass of a refine and a command a user types, and only
// the round tells them apart. `clarify` and `writing` are passes either way, which is what
// `flowByAction` already says.
function flowOf(ask: RunAsk, action: AgentAction): string {
  if (ask.refineRound !== undefined && REFINE_ACTIONS.has(action)) return 'refine'
  // Flows outside the card command list, such as polish and channel, name themselves.
  return flowByAction(action)?.command ?? action
}

/** What each of the create sheet's two run modes can do with a picture (#517): Add task runs
 *  the planner, **Build now** the builder. Read here rather than in the sheet, so the box
 *  turns a paste away against the run that mode would start — never against the chat's
 *  agent, which answers Discuss and nothing else. */
export function createImageAgents(): CreateImageAgents {
  return {
    card: agentImageView(agentForRun({ action: 'create' })),
    build: agentImageView(agentForRun({ action: 'implement' })),
  }
}
