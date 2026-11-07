// A workflow's scheduled agents, as the board starts them (#1401).
//
// Which agents a workflow has is ./workflows.ts. This file decides what a pass is asked with,
// and what stands in a new pass's way.

import { insideRun } from './env'
import { flowNodes } from './stages'
import { readStore } from './store'
import {
  refusal,
  type AgentRequest,
  type DeliveryRecord,
  type RunRecord,
  type RunRefusal,
  type ScheduledPass,
} from './types'

/** One pass of one scheduled agent, as a request. */
export const scheduledRequest = (pass: ScheduledPass): AgentRequest => ({
  action: 'scheduled',
  workflow: pass.workflow,
  specAgent: pass.agent,
})

const isPass = (run: Pick<RunRecord, 'action' | 'workflow' | 'specAgent'>, pass: ScheduledPass): boolean =>
  run.action === 'scheduled' && run.workflow === pass.workflow && run.specAgent === pass.agent

const openPasses = (deliveries: DeliveryRecord[], pass: ScheduledPass): DeliveryRecord[] =>
  deliveries.filter(
    (d) => d.status === 'active' && d.scheduled?.workflow === pass.workflow && d.scheduled.agent === pass.agent,
  )

/** Why a new pass of this agent cannot start: its last one is still running, or still landing. */
export function scheduledBusy(pass: ScheduledPass, store = readStore()): RunRefusal | null {
  const args = { agent: pass.agent, workflow: pass.workflow }
  if (store.runs.some((r) => r.status === 'running' && isPass(r, pass))) {
    return refusal('scheduledRunning', `\`${pass.agent}\` is already running`, args)
  }
  if (openPasses(store.deliveries, pass).some((d) => d.landing)) {
    return refusal('scheduledLanding', `the last run of \`${pass.agent}\` is still landing`, args)
  }
  return null
}

/** The passes of this agent that stopped short and were never carried on — what a new pass
 *  replaces. Asked only once `scheduledBusy` has said nothing. */
export const stalePasses = (pass: ScheduledPass): string[] =>
  openPasses(readStore().deliveries, pass).map((d) => d.deliveryId)

/** The scheduled pass this process is working inside, or null anywhere else. */
export function insideScheduledPass(): ScheduledPass | null {
  const sessionId = insideRun()
  const run = sessionId ? readStore().runs.find((r) => r.sessionId === sessionId) : undefined
  return run?.action === 'scheduled' && run.workflow && run.specAgent
    ? { workflow: run.workflow, agent: run.specAgent }
    : null
}

/** The agent this process is working as, inside a run the board started: a scheduled pass's,
 *  the one a board flow names, or a sub-run's parent's (#1660). Null anywhere else. */
export function runAgent(): string | null {
  const sessionId = insideRun()
  const runs = sessionId ? readStore().runs : []
  const run = runs.find((r) => r.sessionId === sessionId)
  if (!run) return null
  if (run.action !== 'sub') return agentOf(run)
  const parent = runs.find((r) => r.sessionId === run.parentId)
  return parent ? agentOf(parent) : (run.specAgent ?? null)
}

function agentOf(run: RunRecord): string | null {
  if (run.action === 'scheduled') return run.specAgent ?? null
  return flowNodes().find((n) => n.flow === run.action)?.agent ?? null
}
