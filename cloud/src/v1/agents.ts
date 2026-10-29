// The agents page (#2106): each agent of the workflows a project's board holds, and the board's
// own scheduled ones, with the rule the user wrote for it (`rules/<agent>.md`, a board file every
// Runner reads at its next pull) and, for a scheduled one, what is set over its default (#2138).

import type { WorkflowHelper } from '../../../cli/src/lib/agent/types.ts'
import { parseWorkflowFile, stagesOf } from '../../../cli/src/lib/agent/workflow-def.ts'
import { AGENT_NAME, parseSpecAgent, type AgentLines } from '../../../cli/src/lib/agents/parse.ts'
import { isAuto, parseCadence } from '../../../cli/src/lib/cadence.ts'
import { boardFor, rewrite, type BoardRow } from '../board.ts'
import { workflowFolder, workflowRuleFile } from '../board-files.ts'
import { call, mutate } from '../db.ts'
import type { Env } from '../env.ts'
import { badRequest, notFound } from '../errors.ts'
import { json } from '../http.ts'
import { BOARD_ROLES, boardJobOf, scheduleOf, type AgentSchedule } from '../runner-agents.ts'
import { objectOf } from './input.ts'
import { BUILTIN_WORKFLOWS } from './workflows.ts'

const RULE_LIMIT = 20_000

interface Flow {
  id: string
  name: string
  names: { en?: string; zh?: string }
  builtin: boolean
  /** Its preview agents, in order. */
  previews: string[]
  /** The approvals they make when a card chooses them all (#2154), from each one's `after`. */
  stages: string[][]
  /** What runs once the last approval is in; empty: that approval archives the card. */
  land: string[]
  /** Each scheduled agent, with its default cadence. */
  scheduled: { agent: string; cadence: string }[]
}

interface Run {
  agent: string
  workflow: string | null
  at: string
  status: 'running' | 'done' | 'failed'
  last_success: string | null
}

const said = (i18n: Record<string, AgentLines>, key: keyof AgentLines, en?: string) => ({
  ...(en ? { en } : i18n.en?.[key] ? { en: i18n.en[key] } : {}),
  ...(i18n.zh?.[key] ? { zh: i18n.zh[key] } : {}),
})

/** One workflow folder on the board: a built-in's own files, or the project's. */
function flowOf(folder: string, files: Record<string, string>): { flow: Flow; agents: Map<string, ReturnType<typeof parseSpecAgent>> } | null {
  const builtin = BUILTIN_WORKFLOWS.find((w) => workflowFolder(w.id) === folder)
  const held = builtin?.files ?? files
  const read = parseWorkflowFile(folder, held['WORKFLOW.md'] ?? '', 'WORKFLOW.md')
  if ('problem' in read) return null
  const agents = new Map<string, ReturnType<typeof parseSpecAgent>>()
  for (const [name, text] of Object.entries(held)) {
    const at = /^agents\/([^/]+)\/AGENT\.md$/.exec(name)
    if (at) agents.set(at[1]!, parseSpecAgent(text, name, () => null, !!builtin))
  }
  const on = (group: WorkflowHelper[]) => group.filter((h) => !h.off).map((h) => h.agent)
  const previews = on(read.def.previews)
  const after = (name: string) => {
    const one = agents.get(name)
    return one && 'agent' in one ? one.agent.after.filter((other) => previews.includes(other)) : []
  }
  return {
    flow: {
      id: builtin?.id ?? folder.replace(/^wf-/, 'wf_'),
      name: builtin?.name ?? read.def.name,
      names: builtin?.names ?? {},
      builtin: !!builtin,
      previews,
      stages: stagesOf(previews, after),
      land: on(read.def.land),
      scheduled: read.def.scheduled.map((s) => ({ agent: s.agent, cadence: s.cadence ?? 'auto' })),
    },
    agents,
  }
}

/** Built-ins first, as the picker lists them; a Workflow builder task's draft (`task-…/`) is no
 *  workflow yet. An installed built-in is listed before a task first writes its folder. */
function flowsOf(rows: BoardRow[], installed: string[] = []) {
  const folders = new Map<string, Record<string, string>>(installed.map((id) => [workflowFolder(id), {}]))
  for (const r of rows) {
    const [folder, ...rest] = r.path.slice('workflows/'.length).split('/')
    if (!folder || folder.startsWith('task-')) continue
    if (!folders.has(folder)) folders.set(folder, {})
    if (r.content !== null) folders.get(folder)![rest.join('/')] = r.content
  }
  return [...folders].flatMap(([folder, files]) => flowOf(folder, files) ?? [])
    .sort((a, b) => Number(b.flow.builtin) - Number(a.flow.builtin) || a.flow.name.localeCompare(b.flow.name))
}

async function agentsOf(env: Env, account: string, project: string) {
  const { workspace } = await call<{ workspace: string }>(env, 'v1_project', { p_account: account, p_id: project })
  const board = await boardFor(env, project)
  const [workflows, installed, rules, set, runs] = await Promise.all([
    board.list('workflows/'),
    call<string[]>(env, 'v1_installed_workflows', { p_account: account, p_workspace: workspace }),
    board.list('rules/'),
    call<AgentSchedule[] | null>(env, 'v1_agent_schedules', { p_account: account, p_project: project }),
    call<Run[] | null>(env, 'v1_agent_runs', { p_account: account, p_project: project }),
  ])
  const flows = flowsOf(workflows, installed.filter((id) => BUILTIN_WORKFLOWS.some((w) => w.id === id)))
  const textOf = (path: string) => rules.find((r) => r.path === path)?.content?.trim() ?? ''
  const ruleOf = (agent: string) => textOf(`rules/${agent}.md`)

  const out = new Map<string, Record<string, unknown> & { workflows: string[] }>()
  const entry = (agent: string, lines: { title: object; description: object; when: object }) => {
    if (!out.has(agent)) out.set(agent, { agent, ...lines, workflows: [], rule: ruleOf(agent), schedule: null, last_run: null })
    return out.get(agent)!
  }
  const schedule = (cadence: string, name: string, workflow: string | null) => {
    const mine = (runs ?? []).filter((r) => r.agent === name && (r.workflow ?? null) === workflow)
    const latest = mine.sort((a, b) => b.at.localeCompare(a.at))[0]
    const s = scheduleOf(set ?? [], name, workflow)
    return {
      schedule: { on: s?.on ?? true, cadence: s?.cadence ?? cadence, default: cadence, last_success: latest?.last_success ?? null },
      last_run: latest ? { at: latest.at, status: latest.status } : null,
    }
  }
  for (const { flow, agents } of flows) {
    const lines = (agent: string) => {
      const read = agents.get(agent)
      return read && 'agent' in read
        ? {
            title: said(read.agent.i18n, 'title'),
            description: said(read.agent.i18n, 'description', read.agent.description),
            when: said(read.agent.i18n, 'when', read.agent.when),
          }
        : { title: {}, description: {}, when: {} }
    }
    for (const agent of [...flow.previews, ...flow.land, ...flow.scheduled.map((s) => s.agent)]) {
      const one = entry(agent, lines(agent))
      if (!one.workflows.includes(flow.id)) one.workflows.push(flow.id)
    }
    for (const s of flow.scheduled) if (!out.get(s.agent)!.schedule) Object.assign(out.get(s.agent)!, schedule(s.cadence, s.agent, flow.id))
  }
  for (const agent of BOARD_ROLES) Object.assign(entry(agent, { title: {}, description: {}, when: {} }), schedule('auto', boardJobOf(agent)!, null))
  return {
    workflows: flows.map(({ flow }) => ({ ...flow, scheduled: flow.scheduled.map((s) => s.agent), rule: textOf(workflowRuleFile(flow.id)) })),
    board: BOARD_ROLES,
    data: [...out.values()],
    flows: flows.map(({ flow }) => flow),
  }
}

const SECTION = /^##[ \t]+By[ \t]+`?([^`\s]+)`?[ \t]+agent[ \t]*$/gm

/** The name of each preview a card's body draws (#34), by language; one with no name of its
 *  own is left out. */
export async function previewNamesOf(env: Env, project: string, body: string): Promise<Record<string, { en?: string; zh?: string }>> {
  const wanted = new Set([...body.matchAll(SECTION)].map((m) => m[1]!))
  if (!wanted.size) return {}
  const flows = flowsOf(await (await boardFor(env, project)).list('workflows/'), BUILTIN_WORKFLOWS.map((w) => w.id))
  const names: Record<string, { en?: string; zh?: string }> = {}
  for (const { agents } of flows) {
    for (const [agent, read] of agents) {
      if (!wanted.has(agent) || names[agent] || !('agent' in read)) continue
      const title = said(read.agent.i18n, 'title')
      if (title.en || title.zh) names[agent] = title
    }
  }
  return names
}

export async function listAgents(env: Env, account: string, project: string): Promise<Response> {
  const { flows: _flows, ...out } = await agentsOf(env, account, project)
  return json(out)
}

function agentOf(name: string | undefined): string {
  if (!name || name.length > 64 || !AGENT_NAME.test(name)) throw notFound('No agent has this name.')
  return name
}

/** A rule as a request sends it: trimmed text, undefined when not sent. */
function ruleIn(fields: Record<string, unknown>): string | undefined {
  const rule = fields.rule === undefined ? undefined : typeof fields.rule === 'string' ? fields.rule.trim() : null
  if (rule === null) throw badRequest('rule must be text.')
  if (rule !== undefined && rule.length > RULE_LIMIT) throw badRequest(`rule is at most ${RULE_LIMIT} characters.`)
  return rule
}

/** A rule file on the project's board; an empty rule deletes it. */
async function writeRule(env: Env, account: string, project: string, path: string, rule: string) {
  await mutate(env, 'v1_project_write', { p_account: account, p_project: project })
  await rewrite(await boardFor(env, project), [path], (files) =>
    rule || files.get(path)?.content != null ? [{ path, content: rule ? `${rule}\n` : null }] : [])
}

/** Its rule, written on the project's board, and its schedule, in every workflow that lists it. */
export async function updateAgent(env: Env, account: string, project: string, name: string | undefined, body: unknown): Promise<Response> {
  const agent = agentOf(name)
  const fields = objectOf(body)
  const rule = ruleIn(fields)
  let schedule: { on: boolean; cadence: string } | undefined
  if (fields.schedule !== undefined) {
    const s = objectOf(fields.schedule)
    if (typeof s.on !== 'boolean') throw badRequest('schedule.on must be true or false.')
    const cadence = typeof s.cadence === 'string' ? s.cadence.trim() : ''
    if (!isAuto(cadence) && !parseCadence(cadence)) throw badRequest('schedule.cadence is auto, or e.g. 30m, 6h, 7d or 1d at 09:30.')
    schedule = { on: s.on, cadence: isAuto(cadence) ? 'auto' : cadence }
  }
  if (rule === undefined && !schedule) throw badRequest('Send rule or schedule.')

  const held = await agentsOf(env, account, project)
  const one = held.data.find((a) => a.agent === agent)
  if (!one) throw notFound('No agent has this name.')
  if (schedule && !one.schedule) throw badRequest('This agent does not run on a schedule.')

  if (rule !== undefined) await writeRule(env, account, project, `rules/${agent}.md`, rule)
  if (schedule) {
    const job = boardJobOf(agent)
    const where = job
      ? [{ workflow: null, fallback: 'auto' }]
      : held.flows.flatMap((f) => f.scheduled.filter((s) => s.agent === agent).map((s) => ({ workflow: f.id, fallback: s.cadence })))
    const rows = where.map((w) => ({ agent: job ?? agent, workflow: w.workflow, on: schedule.on, cadence: schedule.cadence === w.fallback ? null : schedule.cadence }))
    await mutate(env, 'v1_set_agent_schedules', { p_account: account, p_project: project, p_rows: rows })
  }
  return json((await agentsOf(env, account, project)).data.find((a) => a.agent === agent))
}

/** The rule for every card on one of the project's workflows (#2166), `rules/workflows/<name>.md`. */
export async function updateWorkflowRule(env: Env, account: string, project: string, workflow: string | undefined, body: unknown): Promise<Response> {
  const rule = ruleIn(objectOf(body))
  if (rule === undefined) throw badRequest('Send rule.')
  const held = await agentsOf(env, account, project)
  if (!workflow || !held.workflows.some((w) => w.id === workflow)) throw notFound('No workflow has this id.')
  await writeRule(env, account, project, workflowRuleFile(workflow), rule)
  return json((await agentsOf(env, account, project)).workflows.find((w) => w.id === workflow))
}

/** A scheduled agent's job, queued now on the project's Runner; none while one waits or runs. */
export async function runAgent(env: Env, account: string, project: string, name: string | undefined): Promise<Response> {
  const agent = agentOf(name)
  const held = await agentsOf(env, account, project)
  const one = held.data.find((a) => a.agent === agent)
  if (!one) throw notFound('No agent has this name.')
  if (!one.schedule) throw badRequest('This agent does not run on a schedule.')
  const job = boardJobOf(agent)
  const workflow = job ? null : held.flows.find((f) => f.scheduled.some((s) => s.agent === agent))!.id
  const queued = await mutate<boolean>(env, 'v1_run_agent', { p_account: account, p_project: project, p_agent: job ?? agent, p_workflow: workflow })
  return json({ agent, queued })
}

const SCHEDULE_LINE = /^- ([a-z0-9]+(?:-[a-z0-9]+)*): (on|off)(?:, (.+))?$/

/** The one-off move of a project's `schedules.md` (#2138) into Cloud's own record, by the job each
 *  line's agent runs, and the file off the board. Run by scripts/schedules-move.mjs. */
export async function moveSchedules(env: Env, project: string): Promise<{ agents: number }> {
  const board = await boardFor(env, project)
  const [file] = await board.read(['schedules.md'])
  if (!file?.content) return { agents: 0 }
  const flows = flowsOf(await board.list('workflows/'))
  const rows = file.content.split('\n').flatMap((line) => {
    const m = SCHEDULE_LINE.exec(line.trim())
    if (!m) return []
    const [, agent, on, set] = m as unknown as [string, string, string, string | undefined]
    const cadence = set?.trim() ?? null
    const job = boardJobOf(agent)
    const where = job
      ? [{ workflow: null, fallback: 'auto' }]
      : flows.flatMap(({ flow }) => flow.scheduled.filter((s) => s.agent === agent).map((s) => ({ workflow: flow.id, fallback: s.cadence })))
    return where.map((w) => ({ agent: job ?? agent, workflow: w.workflow, on: on === 'on', cadence: cadence === w.fallback ? null : cadence }))
  })
  await call(env, 'move_agent_schedules', { p_project: project, p_rows: rows })
  await rewrite(board, ['schedules.md'], (files) => (files.get('schedules.md')?.content != null ? [{ path: 'schedules.md', content: null }] : []))
  return { agents: rows.length }
}
