/**
 * A project's periodic agents (#2068), as the Runner judges them due with akb's own rule
 * (cli/src/lib/agent/due.ts): the board's agents at their defaults, and every scheduled agent
 * of the workflows its workspace has. Cloud dedupes and records; the rules live in
 * migrations/0078.
 */

import { parseWorkflowFile } from '../../cli/src/lib/agent/workflow-def.ts'
import { parseSpecAgent, type ScheduleReads } from '../../cli/src/lib/agents/parse.ts'
import { builtinWorkflow } from './v1/workflows.ts'
import type { WorkflowFiles } from './v1/workflow-files.ts'

export interface Attempt {
  startedAt: string
  status: 'running' | 'done' | 'error'
}

export interface PeriodicAgent {
  name: string
  /** A workflow's scheduled agent names its workflow. */
  workflow?: string
  /** A cadence, or `auto`. */
  cadence: string
  /** What `auto` runs on for an agent that reads nothing. */
  fallback: string
  reads?: ScheduleReads
  /** Where a cadence that never passed counts from; null counts from never. */
  since: string | null
  lastSuccess: string | null
  attempts: Attempt[]
  /** Something new for it to read. */
  newWork: boolean
}

interface Held {
  since: string
  builtins: string[]
  workflows: { id: string; files: WorkflowFiles }[]
  runs: { agent: string; workflow: string | null; lastSuccess: string | null; attempts: Attempt[] }[]
  completedAt: string | null
  reflectWaiting: boolean
  dismissalsWaiting: boolean
  schedules: AgentSchedule[]
}

/** The board's own, at the defaults akb ships (cli/src/lib/view/dispatch.ts); `agent` is the
 *  role that runs it, which its rule is kept under. */
const BOARD: { name: string; agent: string; fallback: string; reads?: ScheduleReads; counts?: true }[] = [
  { name: 'reflect', agent: 'proposer', fallback: '6h', reads: 'archived-cards' },
  { name: 'describe-project', agent: 'project-writer', fallback: '1d', reads: 'archived-cards' },
  { name: 'review-dismissals', agent: 'dismissal-reviewer', fallback: '1d', reads: 'dismissals' },
  { name: 'prune-memory', agent: 'memory-pruner', fallback: '7d', counts: true },
]

export const BOARD_AGENTS = BOARD.map((a) => a.name)

/** The board's own scheduled agents, by the role each is. */
export const BOARD_ROLES = BOARD.map((a) => a.agent)

/** The periodic job a board role runs as. */
export const boardJobOf = (agent: string) => BOARD.find((a) => a.agent === agent)?.name ?? null

/** What the agents page set for a scheduled agent off its default (#2138), by the job it runs. */
export interface AgentSchedule {
  agent: string
  workflow: string | null
  on: boolean
  /** Null: its default. */
  cadence: string | null
}

export const scheduleOf = (schedules: AgentSchedule[], agent: string, workflow: string | null = null) =>
  schedules.find((s) => s.agent === agent && s.workflow === workflow)

/** Each scheduled agent a workflow lists: its cadence and what it reads. */
function scheduledOf(id: string, files: WorkflowFiles): { agent: string; cadence: string; reads?: ScheduleReads }[] {
  const read = parseWorkflowFile('workflow', files['WORKFLOW.md'] ?? '', 'WORKFLOW.md')
  if ('problem' in read) return []
  return read.def.scheduled.map(({ agent, cadence }) => {
    const from = `agents/${agent}/AGENT.md`
    const parsed = parseSpecAgent(files[from] ?? '', from, () => null, id.startsWith('wf_builtin_'))
    return { agent, cadence: cadence ?? 'auto', ...('agent' in parsed && parsed.agent.reads ? { reads: parsed.agent.reads } : {}) }
  })
}

/** Each agent's, with what the agents page set over its defaults; one switched off is never due. */
export function periodicAgents(held: Held): PeriodicAgent[] {
  const set = (name: string, workflow?: string) => scheduleOf(held.schedules, name, workflow ?? null)
  const run = (name: string, workflow?: string) => held.runs.find((r) => r.agent === name && (r.workflow ?? undefined) === workflow)
  const after = (at: string | null, than: string | null) => !!at && (!than || Date.parse(at) > Date.parse(than))
  const fresh = (reads: ScheduleReads | undefined, last: string | null) =>
    !reads ? true : reads === 'archived-cards' ? after(held.completedAt, last) : reads === 'dismissals' ? held.dismissalsWaiting : false
  const out: PeriodicAgent[] = BOARD.filter((a) => set(a.name)?.on !== false).map((a) => {
    const r = run(a.name)
    const last = r?.lastSuccess ?? null
    const newWork = a.name === 'reflect' ? held.reflectWaiting : a.name === 'describe-project' ? !last || fresh(a.reads, last) : fresh(a.reads, last)
    return {
      name: a.name,
      cadence: set(a.name)?.cadence ?? 'auto',
      fallback: a.fallback,
      ...(a.reads ? { reads: a.reads } : {}),
      since: a.counts ? held.since : null,
      lastSuccess: last,
      attempts: r?.attempts ?? [],
      newWork,
    }
  })
  const flows = [
    ...held.builtins.flatMap((id) => {
      const builtin = builtinWorkflow(id)
      return builtin ? [{ id, files: builtin.files }] : []
    }),
    ...held.workflows,
  ]
  for (const flow of flows) {
    for (const one of scheduledOf(flow.id, flow.files)) {
      if (set(one.agent, flow.id)?.on === false) continue
      const r = run(one.agent, flow.id)
      const last = r?.lastSuccess ?? null
      out.push({
        name: one.agent,
        workflow: flow.id,
        cadence: set(one.agent, flow.id)?.cadence ?? one.cadence,
        fallback: '1d',
        ...(one.reads ? { reads: one.reads } : {}),
        since: held.since,
        lastSuccess: last,
        attempts: r?.attempts ?? [],
        newWork: fresh(one.reads, last),
      })
    }
  }
  return out
}
