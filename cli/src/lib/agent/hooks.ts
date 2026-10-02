// The hooks a delivery runs after its build (#1328).
//
// A workflow's `execute` stage lists them (stored as `helpers`), and the delivery froze that
// list when it started. Each runs in a session of its own once the build is committed, in
// order; the delivery lands, waits for the user's commit or ends on its files only when the
// last has finished. `delivery.hooks.done` is the whole of what is stored.

import { specAgentCatalog } from '../agents/catalog'
import type { AgentRequest, DeliveryRecord } from './types'

/** The hooks this delivery froze for after its build, in the order they run. One frozen
 *  before its agent stopped being an execute hook (#1402) is skipped. */
export function executeHooks(delivery: DeliveryRecord): string[] {
  const frozen = (delivery.workflow?.stages.execute?.helpers ?? []).map((h) => h.agent)
  if (!frozen.length) return frozen
  const moved = new Set(specAgentCatalog().agents.filter((a) => a.stage !== 'execute').map((a) => a.name))
  return frozen.filter((agent) => !moved.has(agent))
}

/** The hooks still to run since the last build, or none when no build has finished. */
export const owedHooks = (delivery: DeliveryRecord): string[] => {
  const done = delivery.hooks?.done
  return done ? executeHooks(delivery).filter((agent) => !done.includes(agent)) : []
}

/** The run that carries this delivery on: its next owed hook, or nothing. */
export function nextHookRun(delivery: DeliveryRecord | undefined): AgentRequest | null {
  if (!delivery || delivery.status !== 'active' || delivery.review?.stopped) return null
  const [agent] = owedHooks(delivery)
  if (!agent) return null
  return {
    action: 'hook',
    id: delivery.cardId ?? undefined,
    deliveryId: delivery.deliveryId,
    title: delivery.title,
    specAgent: agent,
  }
}

/** The sentence a delivery stops on when a hook did not finish. */
export const hookStopWhy = (agent: string, stopped: boolean): string =>
  `the \`${agent}\` hook ${stopped ? 'was stopped' : 'failed'} after the build, so nothing was delivered`
