// A workflow's scheduled agents, as the board starts them (#1401).
//
// Which agents a workflow has and how often each runs is ./workflows.ts. This file decides
// when one is due, what a pass is asked with, and what stands in a new pass's way.

import { formatStamp, nextDue } from '../cadence'
import { proGate, type ProAccess } from '../cloud/pro'
import { insideRun } from './env'
import { readStore } from './store'
import { refusal, type AgentRequest, type DeliveryRecord, type RunRecord, type RunRefusal, type ScheduledPass } from './types'
import { scheduledClock, scheduledMembers, startScheduledClock, workflows } from './workflows'

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

/**
 * The scheduled agents due right now, one request each.
 *
 * Due is the cadence counted from the later of the last pass that PASSED, the newest attempt's
 * start, and the moment the agent was first seen or switched on — so a failed pass waits a
 * whole cadence, and nothing runs in the minute it was enabled. Nothing asks whether there is
 * work: every cadence starts a pass.
 */
export async function dueScheduledAgents(
  ask: () => Promise<ProAccess>,
  now: Date = new Date(),
): Promise<AgentRequest[]> {
  const store = readStore()
  const due: AgentRequest[] = []
  for (const flow of workflows()) {
    for (const one of scheduledMembers(flow)) {
      if (one.off) continue
      const pass = { workflow: flow.id, agent: one.agent }
      const clock = scheduledClock(one)
      if (!clock) {
        startScheduledClock(flow.id, one.agent, now)
        continue
      }
      const attempts = store.runs.filter((r) => isPass(r, pass)).map((r) => formatStamp(new Date(r.startedAt)))
      const from = [clock, ...attempts].sort().pop()!
      const next = nextDue(from, one.cadence)
      if (!next || next.getTime() > now.getTime()) continue
      if (scheduledBusy(pass, store)) continue
      if (await proGate(flow, ask)) continue
      due.push(scheduledRequest(pass))
    }
  }
  return due
}

/** The scheduled pass this process is working inside, or null anywhere else. */
export function insideScheduledPass(): ScheduledPass | null {
  const sessionId = insideRun()
  const run = sessionId ? readStore().runs.find((r) => r.sessionId === sessionId) : undefined
  return run?.action === 'scheduled' && run.workflow && run.specAgent
    ? { workflow: run.workflow, agent: run.specAgent }
    : null
}
