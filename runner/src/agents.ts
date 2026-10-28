// The projects' periodic agents (#2068): judged due here, by this computer's clock, with akb's
// own rule, from what Cloud keeps of each; a due one is asked of Cloud, which hands back a job
// unless one is open or another computer's pass passed meanwhile.

import { scheduleDue } from '../../cli/src/lib/agent/due'
import * as api from './api'
import type { PeriodicAgent } from './api'

/** How often the agents are looked at: a cadence holds to the minute. */
export const AGENTS_EVERY_MS = 60_000

const ms = (at: string | null) => (at ? Date.parse(at) || 0 : 0)

export function agentDue(agent: PeriodicAgent, now = Date.now()): boolean {
  if (agent.attempts.some((a) => a.status === 'running')) return false
  const due = scheduleDue({
    cadence: agent.cadence,
    fallback: agent.fallback,
    reads: agent.reads,
    from: Math.max(ms(agent.lastSuccess), ms(agent.since)),
    attempts: agent.attempts.map((a) => ({ startedAt: ms(a.startedAt), status: a.status })),
    newWork: () => agent.newWork,
  }, now)
  return !due.wait
}

/** Each project with a folder here: its due agents asked for. Cloud unreached, the next look
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
