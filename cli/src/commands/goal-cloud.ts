import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { cloudEndpoints } from '../lib/cloud/config'
import { accessToken } from '../lib/cloud/session'
import type { MoveResult } from '../lib/types'
import { die } from '../lib/paths'
import { say, quietlyAsync } from '../lib/io'
import { cmdGoal, cmdGoalPreviews, cmdGoalWorkflows, goalsFile, shortWorkflowId, type GoalOptions, type GoalWorkflow, type Goal } from './goal'

export const externalGoalSession = () => !goalsFile() && !process.env.KANBAN_RUN && !process.env.WILDCRANE_JOB && !process.env.AI4KANBAN_BOARD && Boolean(process.env.CLAUDE_CODE_SESSION_ID || process.env.CODEX_THREAD_ID)

async function request<T>(method: string, route: string, body?: unknown): Promise<T> {
  if (externalGoalSession()) process.env.AI4KANBAN_HOME ??= process.env.WILDCRANE_HOME || path.join(os.homedir(), '.wildcrane')
  const token = await accessToken()
  if (!token.ok) die('Sign in through the WildCrane plugin, then try again.')
  const response = await fetch(`${cloudEndpoints().api}${route}`, {
    method, headers: { authorization: `Bearer ${token.token}`, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30_000),
  })
  const value = await response.json() as T & { error?: { message?: string } }
  if (!response.ok) die(value.error?.message ?? `Cloud answered ${response.status}.`)
  return value
}

async function workflows(workspace: string): Promise<GoalWorkflow[]> {
  const all: GoalWorkflow[] = []
  let after: string | null = null
  do {
    const page: { data: GoalWorkflow[]; next: string | null } = await request('GET', `/v1/workflows?workspace=${encodeURIComponent(workspace)}&limit=100${after ? `&after=${encodeURIComponent(after)}` : ''}`)
    all.push(...page.data)
    after = page.next
  } while (after)
  return all
}

type CloudGoal = Omit<Goal, 'task'> & { task: string | { id: string } | null }
interface Discussion { id: string; workspace: string; version: number; goals?: CloudGoal[]; ideas: CloudGoal[] }

function goalsOf(d: Discussion): CloudGoal[] {
  if (d.goals !== undefined && d.ideas !== undefined && JSON.stringify(d.goals) !== JSON.stringify(d.ideas)) die('goals and ideas do not match.')
  const goals = d.goals ?? d.ideas
  if (!Array.isArray(goals)) die('The goals array is missing or invalid.')
  return goals
}

async function discussion(): Promise<Discussion> {
  const session = process.env.CLAUDE_CODE_SESSION_ID || process.env.CODEX_THREAD_ID
  if (!session) die('Goals exist only inside a WildCrane goal discussion.')
  const home = process.env.WILDCRANE_HOME || path.join(os.homedir(), '.wildcrane')
  process.env.AI4KANBAN_HOME ??= home
  const machineFile = path.join(home, 'machine.json')
  let machine: string
  try { machine = JSON.parse(fs.readFileSync(machineFile, 'utf8')).id } catch {
    machine = crypto.randomUUID()
    fs.mkdirSync(home, { recursive: true })
    fs.writeFileSync(machineFile, JSON.stringify({ id: machine }))
  }
  const held = await request<{ folders: { path: string; project: string }[] }>('GET', `/v1/runner/folders?machine=${encodeURIComponent(machine)}`)
  const cwd = fs.realpathSync(process.cwd())
  const folder = held.folders.filter((f) => { try { const dir = fs.realpathSync(f.path); return cwd === dir || cwd.startsWith(dir + path.sep) } catch { return false } }).sort((a, b) => b.path.length - a.path.length)[0]
  return request('POST', '/v1/discussions/external', { requestId: session, host: process.env.CLAUDE_CODE_SESSION_ID ? 'claude-code' : 'codex', ...(folder ? { project: folder.project } : {}) })
}

export async function withGoalDiscussion(action: () => unknown, save = false): Promise<MoveResult & { discussion: string; url: string }> {
  const d = await discussion()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-goals-'))
  const file = path.join(dir, 'goals.json')
  const before = process.env.KANBAN_GOALS
  try {
    const previous = goalsOf(d)
    fs.writeFileSync(file, JSON.stringify({ workspace: d.workspace, workflows: await workflows(d.workspace), ideas: previous.map((g) => ({ ...g, task: typeof g.task === 'object' && g.task ? g.task.id : g.task })) }))
    process.env.KANBAN_GOALS = file
    const result = (save ? await quietlyAsync(async () => action()) : await action()) as Record<string, unknown>
    if (save) {
      const goals = JSON.parse(fs.readFileSync(file, 'utf8')).ideas as Goal[]
      const saved = await request<Discussion>('PUT', `/v1/discussions/${d.id}/draft`, { expectedVersion: d.version, goals: goals.filter((g) => !g.dropped) })
      const savedGoals = goalsOf(saved)
      const fresh = goals.filter((g) => !g.dropped && !previous.some((p) => p.id === g.id))
      const made = savedGoals.filter((g) => !previous.some((p) => p.id === g.id))
      const actualId = (id: string) => made[fresh.findIndex((g) => g.id === id)]?.id ?? id
      if (typeof result.id === 'string') result.id = actualId(result.id)
      for (const goal of goals.filter((g) => g.start && !g.task)) {
        const actual = savedGoals.find((g) => g.id === actualId(goal.id))
        if (actual) await request('POST', `/v1/discussions/${d.id}/goals/${actual.id}/start`, { expectedVersion: saved.version })
      }
      say(`${result.dropped ? 'Dropped' : result.start ? 'Started' : 'Saved'} goal ${result.id}${result.title ? `: ${result.title}` : ''}.`)
    }
    const url = `${process.env.WILDCRANE_WEB_URL || 'https://app.wildcrane.ai'}/discussions/${d.id}`
    say(url)
    return { ...result, discussion: d.id, url }
  } finally {
    if (before === undefined) delete process.env.KANBAN_GOALS
    else process.env.KANBAN_GOALS = before
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

export const cloudGoal = (args: string[], opts: GoalOptions) => withGoalDiscussion(() => cmdGoal(args, opts), true)
export const cloudGoalWorkflows = () => withGoalDiscussion(cmdGoalWorkflows)
export async function queryPreviews(workflow: string, workspace?: string) {
  if (!workspace) {
    if (externalGoalSession()) return withGoalDiscussion(() => cmdGoalPreviews(workflow))
    die('--workspace is required outside a goal discussion.')
  }
  const list = await workflows(workspace)
  const flow = list.find((w) => w.id === workflow || shortWorkflowId(w.id) === workflow)
  if (!flow) die(`No workflow \`${workflow}\` here.`)
  if (!flow.previews) die('Preview agents are unavailable; update Runner and try again.')
  const agents = flow.previews.map((p) => ({ name: p.agent, when: p.when || null }))
  say(agents.length ? agents.map((p) => `${p.name}\n  ${p.when ?? 'Not configured'}`).join('\n') : 'This workflow has no preview agent. Ask for none.')
  return { agents, problems: [] }
}
