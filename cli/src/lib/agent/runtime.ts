// Which runtime one run goes on (#343).
//
// The board names the runtimes and points each flow and agent at one (agent/settings.ts);
// this is the one place that reads that pointing for a run about to start. What the answer
// then RUNS as is agent/resolve.ts's, out of the same board file.
//
// Only a flow is named, never a pass: a refine's `clarify`, `resolve` and `writing` passes
// take refine's runtime. `setup` is always the global one — it is the run that has to work
// on a board nobody has configured yet.

import { specAgentNames } from '../spec-agent-names'
import { flowByAction } from './flows'
import { readRuntimes, specAgentEntries, type BoardRuntimes } from './settings'
import { REFINE_ACTIONS, SPECIALIST_ACTIONS } from './types'
import type { AgentAction } from './types'

/** What a run has to say about itself for its runtime to be worked out. The same three
 *  fields `agent/rules.ts` reads to hand a run its flow's rule, and read the same way. */
export interface RuntimeAsk {
  action?: AgentAction
  /** The agent's name on a `spec` or `write` run, and nothing on any other. */
  specAgent?: string
  /** Set on a pass a refine spawned, absent on a flow a user typed — the one thing that
   *  tells a refine's `resolve` pass from an `akb card resolve` of its own. */
  refineRound?: number
}

/** The runtime a run goes on. Always one of the board's runtimes: a flow that names none,
 *  and one naming a runtime the board no longer holds, both read as the global one. */
export function runtimeFor(
  ask: RuntimeAsk = {},
  runtimes: BoardRuntimes = readRuntimes(),
  entries = specAgentEntries(),
): string {
  const named = namedRuntime(ask, runtimes, entries)
  return named && runtimes.names.includes(named) ? named : runtimes.global
}

function namedRuntime(
  ask: RuntimeAsk,
  runtimes: BoardRuntimes,
  entries: ReturnType<typeof specAgentEntries>,
): string | undefined {
  const { action, specAgent } = ask
  if (!action || action === 'setup') return undefined
  // A specialist runs on the runtime its own entry names, whichever hook it is on.
  if (SPECIALIST_ACTIONS.has(action)) return specAgent ? runtimeOfSpecAgent(specAgent, entries) : undefined
  const command = flowOf(ask, action)
  return command ? runtimes.flows[command] : undefined
}

// The command whose runtime this run takes. A pass belongs to the flow that spawned it,
// never to a flow of its own name: `resolve` is both a pass of a refine and a command a
// user types, and only the round tells them apart. `clarify` and `writing` are passes
// either way, which is what `flowByAction` already says.
function flowOf(ask: RuntimeAsk, action: AgentAction): string | undefined {
  if (ask.refineRound !== undefined && REFINE_ACTIONS.has(action)) return 'refine'
  return flowByAction(action)?.command
}

/** The runtime one flow runs on, by the command a user types. A flow that names none, and
 *  one naming a runtime the board no longer holds, both run the global one. */
export function runtimeOfFlow(command: string, runtimes: BoardRuntimes = readRuntimes()): string {
  const named = runtimes.flows[command]
  return named && runtimes.names.includes(named) ? named : runtimes.global
}

/** The runtime one spec agent names, under its current name or one it used to have. */
export function runtimeOfSpecAgent(name: string, entries = specAgentEntries()): string | undefined {
  for (const candidate of specAgentNames(name)) {
    const runtime = entries[candidate]?.runtime
    if (runtime) return runtime
  }
  return undefined
}
