// A workflow's scheduled agents, as the board starts them (#1401).
//
// Which agents a workflow has and how often each runs is ./workflows.ts. This file decides
// when one is due (./due.ts), what a pass is asked with, and what stands in a new pass's way.

import { specAgentCatalog } from '../agents/catalog'
import { proGate, type ProAccess } from '../cloud/pro'
import { agentsWithBacklog, building, readsNew, scheduleDue, stampMs, type DueAnswer } from './due'
import { insideRun } from './env'
import { flowNodes } from './stages'
import { readStore, type Store } from './store'
import {
  refusal,
  SCHEDULED_CADENCE,
  type AgentRequest,
  type DeliveryRecord,
  type RunRecord,
  type RunRefusal,
  type ScheduledPass,
  type WorkflowScheduled,
} from './types'
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

/** When one scheduled agent may next start, and what holds it now (#1475). The gap counts
 *  from the later of its clock and its newest attempt; `auto` leaves it to `reads`. */
export function scheduledWait(
  pass: ScheduledPass,
  one: WorkflowScheduled,
  store: Store = readStore(),
  backlog: () => Set<string> = agentsWithBacklog,
  now: Date = new Date(),
): DueAnswer {
  const reads = specAgentCatalog().agents.find((a) => a.name === one.agent)?.reads
  const lastRun = stampMs(one.lastRun)
  return scheduleDue(
    {
      cadence: one.cadence,
      fallback: SCHEDULED_CADENCE,
      reads,
      from: stampMs(scheduledClock(one)),
      attempts: store.runs.filter((r) => isPass(r, pass)),
      newWork: () => !reads || readsNew(reads, lastRun),
      backlog: () => backlog().has(one.agent),
      building: () => building(store),
    },
    now.getTime(),
  )
}

/** When its next pass may start and what holds it, or null while it is off or has no clock. */
export function scheduledNext(workflow: string, one: WorkflowScheduled): DueAnswer | null {
  return one.off || !scheduledClock(one) ? null : scheduledWait({ workflow, agent: one.agent }, one)
}

/**
 * The scheduled agents due right now, one request each (`scheduledWait`). Nothing runs in the
 * minute an agent was first seen or switched on.
 */
export async function dueScheduledAgents(
  ask: () => Promise<ProAccess>,
  now: Date = new Date(),
): Promise<AgentRequest[]> {
  const store = readStore()
  let held: Set<string> | undefined
  const backlog = () => (held ??= agentsWithBacklog())
  const due: AgentRequest[] = []
  for (const flow of workflows()) {
    for (const one of scheduledMembers(flow)) {
      if (one.off) continue
      const pass = { workflow: flow.id, agent: one.agent }
      if (!scheduledClock(one)) {
        startScheduledClock(flow.id, one.agent, now)
        continue
      }
      if (scheduledWait(pass, one, store, backlog, now).wait) continue
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

/** The agent this process is working as, inside a run the board started: a scheduled pass's,
 *  or the one a board flow names. Null anywhere else. */
export function runAgent(): string | null {
  const sessionId = insideRun()
  const run = sessionId ? readStore().runs.find((r) => r.sessionId === sessionId) : undefined
  if (!run) return null
  if (run.action === 'scheduled') return run.specAgent ?? null
  return flowNodes().find((n) => n.flow === run.action)?.agent ?? null
}
