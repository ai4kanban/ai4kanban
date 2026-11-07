// The projects' periodic agents (#2068): judged due here, at the top of each hour by this
// computer's clock (#291), with akb's own rule, from what Cloud keeps of each; a due one is asked
// of Cloud, which hands back a job unless one is open or another computer's pass passed meanwhile.

import { scheduleDue } from '../../cli/src/lib/agent/due'
import * as api from './api'
import type { PeriodicAgent } from './api'

/** The top of the next hour, when the agents are next looked at. */
export function nextHour(now = Date.now()): number {
  const at = new Date(now)
  at.setMinutes(60, 0, 0)
  return at.getTime()
}

/** A pass counts from its nearest hour: asked for at 12:00 and stamped by Cloud's clock at 11:59
 *  or 12:01, a 6h agent still comes round at 18:00. */
function hourOf(at: string | null): number {
  const hour = new Date(at ?? NaN)
  if (Number.isNaN(hour.getTime())) return 0
  hour.setMinutes(hour.getMinutes() + 30, 0, 0)
  hour.setMinutes(0, 0, 0)
  return hour.getTime()
}

export function agentDue(agent: PeriodicAgent, now = Date.now()): boolean {
  if (agent.attempts.some((a) => a.status === 'running')) return false
  const due = scheduleDue({
    cadence: agent.cadence,
    fallback: agent.fallback,
    reads: agent.reads,
    from: Math.max(hourOf(agent.lastSuccess), hourOf(agent.since)),
    attempts: agent.attempts.map((a) => ({ startedAt: hourOf(a.startedAt), status: a.status })),
    newWork: () => agent.newWork,
  }, now)
  return !due.wait
}

/** Each project with a folder here: its due agents asked for. Cloud unreached, the next hour
 *  tries again. True when a job came back. */
export async function askDueAgents(machineId: string, now = Date.now()): Promise<boolean> {
  const folders = await api.listFolders(machineId)
  if (!folders.ok) return false
  let started = false
  for (const { project } of folders.value.folders) {
    const read = await api.readAgents(machineId, project)
    if (!read.ok) continue
    for (const agent of read.value.agents.filter((a) => agentDue(a, now))) {
      const asked = await api.requestAgent(machineId, project, agent.name, agent.workflow ?? null, agent.lastSuccess)
      if (!asked.ok) console.error(`runner: ${agent.name} was not started on ${project}: ${asked.error}`)
      else if (asked.value.job) started = true
    }
  }
  return started
}
