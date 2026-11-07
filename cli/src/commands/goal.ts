// 目标草稿沿用 KANBAN_IDEAS 和 ideas 文件字段，兼容旧 Runner。

import fs from 'node:fs'
import { canonicalSpecAgent } from '../lib/spec-agent-names'

import { say } from '../lib/io'
import { die } from '../lib/paths'
import { noWorkflowMessage } from '../lib/agent/workflows'
import type { MoveResult } from '../lib/types'

export interface GoalOptions {
  id?: string
  title?: string
  bodyFile?: string
  workflow?: string
  previews?: string
}

export interface GoalWorkflow {
  previews?: { agent: string; title?: { en?: string; zh?: string }; when: string }[]
  id: string
  name: string
  description?: string
  when?: string
}

export interface Goal {
  id: string
  title: string
  outcome: string
  acceptance: string[]
  previews?: string[]
  workflow: string
  task?: string | null
  start?: boolean
  dropped?: boolean
}

export interface GoalsFile {
  workspace?: string
  workflows: GoalWorkflow[]
  goals: Goal[]
}

const MAX_GOALS = 10

export const goalsFile = (): string | null => process.env.KANBAN_GOALS || process.env.KANBAN_IDEAS || null

export function loadGoals(): { file: string; held: GoalsFile } {
  const file = goalsFile()
  if (!file) die('Goals exist only inside a WildCrane goal discussion.')
  const held = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<GoalsFile> & { ideas?: Goal[] }
  if (held.goals !== undefined && held.ideas !== undefined && JSON.stringify(held.goals) !== JSON.stringify(held.ideas)) die('goals and ideas do not match.')
  const goals = held.goals ?? held.ideas
  if (!Array.isArray(goals)) die('The goals array is missing or invalid.')
  return { file, held: { ...held, workflows: held.workflows ?? [], goals } }
}

/** A built-in's short name, as `akb workflow list` shows it: `wf_builtin_slide_deck` → `slide-deck`. */
export const shortWorkflowId = (id: string) =>
  id.startsWith('wf_builtin_') ? id.slice('wf_builtin_'.length).replace(/_/g, '-') : id

export function workflowOf(held: GoalsFile, asked: string): string {
  const wanted = asked.trim()
  const found = held.workflows.find((w) => w.id === wanted || shortWorkflowId(w.id) === wanted)
  if (!found) die(`No workflow \`${wanted}\` here. It has: ${held.workflows.map((w) => shortWorkflowId(w.id)).join(', ')}.`)
  return found.id
}

function fallbackWorkflow(held: GoalsFile): string {
  const first = held.workflows[0]?.id
  if (!first) die(noWorkflowMessage(''))
  return first!
}

/** The body split as Cloud keeps it: `## Done when` items are the acceptance, the rest the outcome. */
export function splitBody(text: string): { outcome: string; acceptance: string[] } {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const at = lines.findIndex((l) => /^##\s+done when\s*$/i.test(l.trim()))
  if (at < 0) return { outcome: text.trim(), acceptance: [] }
  const rest = lines.slice(at + 1)
  const end = rest.findIndex((l) => /^#{1,2}\s/.test(l))
  const section = end < 0 ? rest : rest.slice(0, end)
  const acceptance = section.map((l) => l.trim().replace(/^([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?/, '').trim()).filter(Boolean)
  const outcome = [...lines.slice(0, at), ...(end < 0 ? [] : rest.slice(end))].join('\n').trim()
  return { outcome, acceptance }
}

function readBody(bodyFile: string | undefined): { outcome: string; acceptance: string[] } {
  if (!bodyFile) die('--body-file is required; write the goal in a writable temporary file first.')
  const text = fs.readFileSync(bodyFile, 'utf8')
  if (!text.trim()) die('The goal must not be empty.')
  return splitBody(text)
}

const open = (goal: Goal) => !goal.dropped && !goal.task

function named(held: GoalsFile, id: string | undefined): Goal {
  const goal = held.goals.find((i) => i.id === id?.trim() && !i.dropped)
  if (!goal) die(`--id must name a goal of this conversation: ${held.goals.filter((i) => !i.dropped).map((i) => i.id).join(', ') || 'none yet'}.`)
  return goal
}

export function cmdGoal(args: string[], opts: GoalOptions): MoveResult {
  const sub = args[0] ?? ''
  const { file, held } = loadGoals()
  const write = () => fs.writeFileSync(file, `${JSON.stringify({ ...held, goals: undefined, ideas: held.goals }, null, 2)}\n`)

  if (sub === 'new') {
    const title = opts.title?.trim()
    if (!title) die('--title must not be empty')
    if (held.goals.filter(open).length >= MAX_GOALS) die(`A conversation holds at most ${MAX_GOALS} goals; drop one first.`)
    const body = readBody(opts.bodyFile)
    const workflow = opts.workflow ? workflowOf(held, opts.workflow) : fallbackWorkflow(held)
    const id = `new_${held.goals.filter((i) => i.id.startsWith('new_')).length + 1}`
    const previews = goalPreviews(held, workflow, opts.previews)
    held.goals.push({ id, title, ...body, workflow, previews, task: null })
    write()
    say(`Saved goal ${id}: ${title} (${shortWorkflowId(workflow)}).`)
    return { id, title, workflow, previews }
  }

  const goal = named(held, opts.id)
  if (goal.task) die(`${goal.id} is already a task; it no longer changes here.`)
  if (sub === 'save') {
    const workflow = opts.workflow !== undefined ? workflowOf(held, opts.workflow) : goal.workflow
    const previews = opts.previews !== undefined ? goalPreviews(held, workflow, opts.previews) : workflow === goal.workflow ? goal.previews ?? [] : []
    if (opts.title !== undefined) {
      if (!opts.title.trim()) die('--title must not be empty')
      goal.title = opts.title.trim()
    }
    if (opts.bodyFile !== undefined) Object.assign(goal, readBody(opts.bodyFile))
    Object.assign(goal, { workflow, previews })
    write()
    say(`Saved goal ${goal.id}: ${goal.title} (${shortWorkflowId(goal.workflow)}).`)
    return { id: goal.id, title: goal.title, workflow: goal.workflow, previews: goal.previews }
  }
  if (sub === 'drop') {
    goal.dropped = true
    write()
    say(`Dropped goal ${goal.id}.`)
    return { id: goal.id, dropped: true }
  }
  if (sub === 'start') {
    goal.start = true
    write()
    say(`Goal ${goal.id} starts as a task when this turn ends.`)
    return { id: goal.id, start: true }
  }
  die('Use goal new, save, drop or start.')
}

/** `akb workflow list` inside a goal discussion: the workspace's installed workflows. */
export function cmdGoalWorkflows(): MoveResult {
  const { held } = loadGoals()
  for (const w of held.workflows) {
    say(`${shortWorkflowId(w.id)}  ${w.name}`)
    if (w.description && w.description !== w.name) say(`  ${w.description}`)
    if (w.when) say(`  when        ${w.when}`)
  }
  return { workflows: held.workflows.map((w) => ({ ...w, id: shortWorkflowId(w.id) })) }
}


export function goalPreviews(held: GoalsFile, workflow: string, asked = ''): string[] {
  if (!asked.trim()) return []
  const catalog = held.workflows.find((w) => w.id === workflow)?.previews
  if (!catalog) die('Preview agents are unavailable; update Runner and try again.')
  const names = asked.split(',').map((p) => canonicalSpecAgent(({ ui: 'ui-designer', api: 'api-designer' } as Record<string, string>)[p.trim()] ?? p.trim()))
  if (names.length > 50) die('previews must contain at most 50 agent names.')
  for (const name of names) if (!catalog.some((p) => p.agent === name)) die(`Preview agent ${name} is not enabled in workflow ${workflow}.`)
  return catalog.filter((p) => names.includes(p.agent)).map((p) => p.agent)
}

export function cmdGoalPreviews(workflow: string): MoveResult {
  const { held } = loadGoals()
  const id = workflowOf(held, workflow)
  const catalog = held.workflows.find((w) => w.id === id)?.previews
  if (!catalog) die('Preview agents are unavailable; update Runner and try again.')
  const agents = catalog.map((p) => ({ name: p.agent, when: p.when || null }))
  say(agents.length ? agents.map((p) => `${p.name}\n  ${p.when ?? 'Not configured'}`).join('\n') : 'This workflow has no preview agent. Ask for none.')
  return { agents, problems: [] }
}
